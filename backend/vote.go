package main

import (
	"context"
	"net/http"
	"strings"
	"time"

	"HCL_poll/backend/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

var voteCollection *mongo.Collection

type VoteRequest struct {
	OptionID string `json:"optionId"`
	VoterID  string `json:"voterId"`
}

func VotePoll(c *gin.Context) {
	shareToken := c.Param("shareToken")

	var req VoteRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	req.OptionID = strings.TrimSpace(req.OptionID)
	req.VoterID = strings.TrimSpace(req.VoterID)

	if req.OptionID == "" || req.VoterID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Option ID and voter ID are required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	
	var poll models.Poll

	err := pollCollection.FindOne(
		ctx,
		bson.M{"shareToken": shareToken},
	).Decode(&poll)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Poll not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to find poll",
		})
		return
	}

	
	if poll.Status == "active" && poll.ExpiresAt != nil && time.Now().After(*poll.ExpiresAt) {
		poll.Status = "expired"

		_, err = pollCollection.UpdateOne(
			ctx,
			bson.M{"_id": poll.ID},
			bson.M{
				"$set": bson.M{
					"status":    "expired",
					"updatedAt": time.Now(),
				},
			},
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to update poll status",
			})
			return
		}
	}

	
	if poll.Status != "active" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "This poll is no longer active",
		})
		return
	}

	
	optionExists := false

	for _, option := range poll.Options {
		if option.ID == req.OptionID {
			optionExists = true
			break
		}
	}

	if !optionExists {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid option",
		})
		return
	}

	
	var existingVote models.Vote

	err = voteCollection.FindOne(
		ctx,
		bson.M{
			"pollId":  poll.ID,
			"voterId": req.VoterID,
		},
	).Decode(&existingVote)

	if err == nil {
		c.JSON(http.StatusConflict, gin.H{
			"error": "You have already voted in this poll",
		})
		return
	}

	if err != mongo.ErrNoDocuments {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to check existing vote",
		})
		return
	}

	
	vote := models.Vote{
		ID:        bson.NewObjectID(),
		PollID:    poll.ID,
		OptionID:  req.OptionID,
		VoterID:   req.VoterID,
		CreatedAt: time.Now(),
	}

	_, err = voteCollection.InsertOne(ctx, vote)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to save vote",
		})
		return
	}

	// Notify Redis that a new vote was submitted
	err = RedisClient.Publish(
		ctx,
		"poll:"+shareToken,
		shareToken,
	).Err()

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Vote saved, but failed to publish realtime update",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Vote submitted successfully",
	})


}
