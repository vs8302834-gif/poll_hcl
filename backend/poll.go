package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"HCL_poll/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

var pollCollection *mongo.Collection

// ==================================================
// CREATE POLL
// ==================================================

type CreatePollRequest struct {
	Question  string   `json:"question"`
	Options   []string `json:"options"`
	ExpiresAt string   `json:"expiresAt"`
}

func CreatePoll(c *gin.Context) {

	var req CreatePollRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// -----------------------------------
	// VALIDATE QUESTION
	// -----------------------------------

	req.Question = strings.TrimSpace(req.Question)

	if req.Question == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Question is required",
		})
		return
	}

	// -----------------------------------
	// VALIDATE OPTIONS
	// -----------------------------------

	if len(req.Options) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "At least 2 options are required",
		})
		return
	}

	options := make([]models.PollOption, 0, len(req.Options))

	for _, optionText := range req.Options {

		optionText = strings.TrimSpace(optionText)

		if optionText == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Options cannot be empty",
			})
			return
		}

		options = append(options, models.PollOption{
			ID:   uuid.New().String(),
			Text: optionText,
		})
	}

	// -----------------------------------
	// OPTIONAL EXPIRATION
	// -----------------------------------

	var expiresAt *time.Time

	if strings.TrimSpace(req.ExpiresAt) != "" {

		parsedExpiration, err := time.Parse(
			time.RFC3339,
			req.ExpiresAt,
		)

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid expiration time. Use RFC3339 format",
			})
			return
		}

		if !parsedExpiration.After(time.Now()) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Expiration time must be in the future",
			})
			return
		}

		expiresAt = &parsedExpiration
	}

	// -----------------------------------
	// GET LOGGED-IN USER
	// -----------------------------------

	userIDString, exists := c.Get("userId")

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	userID, err := bson.ObjectIDFromHex(
		userIDString.(string),
	)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	// -----------------------------------
	// CREATE POLL
	// -----------------------------------

	now := time.Now()

	poll := models.Poll{
		ID:         bson.NewObjectID(),
		CreatorID:  userID,
		Question:   req.Question,
		Options:    options,
		ExpiresAt:  expiresAt,
		Status:     "active",
		ShareToken: uuid.New().String(),
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	_, err = pollCollection.InsertOne(ctx, poll)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create poll",
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Poll created successfully",
		"poll":    poll,
	})
}

// ==================================================
// GET MY POLLS
// ==================================================

func GetMyPolls(c *gin.Context) {

	userIDString, exists := c.Get("userId")

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "User not authenticated",
		})
		return
	}

	userID, err := bson.ObjectIDFromHex(
		userIDString.(string),
	)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	cursor, err := pollCollection.Find(
		ctx,
		bson.M{
			"creatorId": userID,
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch polls",
		})
		return
	}

	defer cursor.Close(ctx)

	var polls []models.Poll

	if err := cursor.All(ctx, &polls); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to read polls",
		})
		return
	}

	if polls == nil {
		polls = []models.Poll{}
	}

	// -----------------------------------
	// UPDATE EXPIRED POLLS
	// -----------------------------------

	for i := range polls {

		if polls[i].Status == "active" &&
			polls[i].ExpiresAt != nil &&
			time.Now().After(*polls[i].ExpiresAt) {

			polls[i].Status = "expired"

			_, _ = pollCollection.UpdateOne(
				ctx,
				bson.M{
					"_id": polls[i].ID,
				},
				bson.M{
					"$set": bson.M{
						"status":    "expired",
						"updatedAt": time.Now(),
					},
				},
			)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"polls": polls,
	})
}

// ==================================================
// GET POLL BY SHARE TOKEN
// ==================================================

func GetPollByShareToken(c *gin.Context) {

	shareToken := c.Param("shareToken")

	if shareToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Share token is required",
		})
		return
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	var poll models.Poll

	err := pollCollection.FindOne(
		ctx,
		bson.M{
			"shareToken": shareToken,
		},
	).Decode(&poll)

	if err != nil {

		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Poll not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch poll",
		})
		return
	}

	// -----------------------------------
	// AUTOMATICALLY MARK EXPIRED POLL
	// -----------------------------------

	if poll.Status == "active" &&
		poll.ExpiresAt != nil &&
		time.Now().After(*poll.ExpiresAt) {

		poll.Status = "expired"

		_, err = pollCollection.UpdateOne(
			ctx,
			bson.M{
				"_id": poll.ID,
			},
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

	c.JSON(http.StatusOK, gin.H{
		"poll": poll,
	})
}

// ==================================================
// CHANGE POLL EXPIRATION
// ==================================================

type ChangeExpirationRequest struct {
	ExpiresAt string `json:"expiresAt"`
}

func ChangePollExpiration(c *gin.Context) {

	shareToken := c.Param("shareToken")

	if shareToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Share token is required",
		})
		return
	}

	// -----------------------------------
	// GET LOGGED-IN USER
	// -----------------------------------

	userIDValue, exists := c.Get("userId")

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Unauthorized",
		})
		return
	}

	userID, err := bson.ObjectIDFromHex(
		userIDValue.(string),
	)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	// -----------------------------------
	// FIND POLL
	// -----------------------------------

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	var poll models.Poll

	err = pollCollection.FindOne(
		ctx,
		bson.M{
			"shareToken": shareToken,
			"creatorId":  userID,
		},
	).Decode(&poll)

	if err != nil {

		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Poll not found or you are not the creator",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to find poll",
		})
		return
	}

	// -----------------------------------
	// CLOSED POLLS CANNOT BE MODIFIED
	// -----------------------------------

	if poll.Status == "closed" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Closed polls cannot be modified",
		})
		return
	}

	var req ChangeExpirationRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// -----------------------------------
	// PARSE NEW EXPIRATION
	// -----------------------------------

	var newExpiration *time.Time

	if strings.TrimSpace(req.ExpiresAt) != "" {

		parsedExpiration, err := time.Parse(
			time.RFC3339,
			req.ExpiresAt,
		)

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid expiration time",
			})
			return
		}

		if !parsedExpiration.After(time.Now()) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Expiration time must be in the future",
			})
			return
		}

		newExpiration = &parsedExpiration
	}

	// -----------------------------------
	// UPDATE POLL
	// -----------------------------------

	now := time.Now()

	updateFields := bson.M{
		"expiresAt": newExpiration,
		"updatedAt": now,
		"status":    "active",
	}

	_, err = pollCollection.UpdateOne(
		ctx,
		bson.M{
			"_id":       poll.ID,
			"creatorId":  userID,
			"shareToken": shareToken,
		},
		bson.M{
			"$set": updateFields,
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update expiration",
		})
		return
	}

	poll.ExpiresAt = newExpiration
	poll.Status = "active"
	poll.UpdatedAt = now

	// -----------------------------------
	// REALTIME NOTIFICATION
	// -----------------------------------

	if err = RedisClient.Publish(
		ctx,
		"poll:"+shareToken,
		shareToken,
	).Err(); err != nil {
		fmt.Println("Redis publish error:", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Expiration updated successfully",
		"poll":    poll,
	})
}

// ==================================================
// CLOSE POLL
// ==================================================

func ClosePoll(c *gin.Context) {

	shareToken := c.Param("shareToken")

	if shareToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Share token is required",
		})
		return
	}

	// -----------------------------------
	// GET LOGGED-IN USER
	// -----------------------------------

	userIDValue, exists := c.Get("userId")

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Unauthorized",
		})
		return
	}

	userID, err := bson.ObjectIDFromHex(
		userIDValue.(string),
	)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	// -----------------------------------
	// FIND POLL
	// -----------------------------------

	var poll models.Poll

	err = pollCollection.FindOne(
		ctx,
		bson.M{
			"shareToken": shareToken,
			"creatorId":  userID,
		},
	).Decode(&poll)

	if err != nil {

		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Poll not found or you are not the creator",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to find poll",
		})
		return
	}

	// -----------------------------------
	// CHECK ALREADY CLOSED
	// -----------------------------------

	if poll.Status == "closed" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Poll is already closed",
		})
		return
	}

	// -----------------------------------
	// CLOSE POLL
	// -----------------------------------

	now := time.Now()

	_, err = pollCollection.UpdateOne(
		ctx,
		bson.M{
			"_id":       poll.ID,
			"creatorId":  userID,
		},
		bson.M{
			"$set": bson.M{
				"status":    "closed",
				"updatedAt": now,
			},
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to close poll",
		})
		return
	}

	// -----------------------------------
	// REALTIME NOTIFICATION
	// -----------------------------------

	if err = RedisClient.Publish(
		ctx,
		"poll:"+shareToken,
		shareToken,
	).Err(); err != nil {
		fmt.Println("Redis publish error:", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Poll closed successfully",
	})
}

// ==================================================
// DELETE POLL
// ==================================================

func DeletePoll(c *gin.Context) {

	shareToken := c.Param("shareToken")

	if shareToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid poll",
		})
		return
	}

	// -----------------------------------
	// GET LOGGED-IN USER
	// -----------------------------------

	userIDValue, exists := c.Get("userId")

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Unauthorized",
		})
		return
	}

	userID, err := bson.ObjectIDFromHex(
		userIDValue.(string),
	)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	// -----------------------------------
	// FIND POLL
	// -----------------------------------

	var poll models.Poll

	err = pollCollection.FindOne(
		ctx,
		bson.M{
			"shareToken": shareToken,
			"creatorId":  userID,
		},
	).Decode(&poll)

	if err != nil {

		c.JSON(http.StatusNotFound, gin.H{
			"error": "Poll not found or you are not the creator",
		})

		return
	}

	// -----------------------------------
	// DELETE VOTES
	// -----------------------------------

	_, err = voteCollection.DeleteMany(
		ctx,
		bson.M{
			"pollId": poll.ID,
		},
	)

	if err != nil {

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete poll votes",
		})

		return
	}

	// -----------------------------------
	// DELETE POLL
	// -----------------------------------

	_, err = pollCollection.DeleteOne(
		ctx,
		bson.M{
			"_id":       poll.ID,
			"creatorId": userID,
		},
	)

	if err != nil {

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete poll",
		})

		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Poll deleted successfully",
	})
}

// ==================================================
// OPEN POLL
// ==================================================

func OpenPoll(c *gin.Context) {

	shareToken := c.Param("shareToken")

	if shareToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Share token is required",
		})
		return
	}

	// -----------------------------------
	// GET LOGGED-IN USER
	// -----------------------------------

	userIDValue, exists := c.Get("userId")

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Unauthorized",
		})
		return
	}

	userID, err := bson.ObjectIDFromHex(
		userIDValue.(string),
	)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid user ID",
		})
		return
	}

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	// -----------------------------------
	// FIND POLL
	// -----------------------------------

	var poll models.Poll

	err = pollCollection.FindOne(
		ctx,
		bson.M{
			"shareToken": shareToken,
			"creatorId":  userID,
		},
	).Decode(&poll)

	if err != nil {

		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Poll not found or you are not the creator",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to find poll",
		})
		return
	}

	// -----------------------------------
	// CHECK EXPIRATION
	// -----------------------------------

	if poll.ExpiresAt != nil &&
		time.Now().After(*poll.ExpiresAt) {

		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Cannot open poll because its expiration time has passed",
		})
		return
	}

	// -----------------------------------
	// OPEN POLL
	// -----------------------------------

	now := time.Now()

	_, err = pollCollection.UpdateOne(
		ctx,
		bson.M{
			"_id":       poll.ID,
			"creatorId": userID,
		},
		bson.M{
			"$set": bson.M{
				"status":    "active",
				"updatedAt": now,
			},
		},
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to open poll",
		})
		return
	}

	// -----------------------------------
	// REALTIME NOTIFICATION
	// -----------------------------------

	if err = RedisClient.Publish(
		ctx,
		"poll:"+shareToken,
		shareToken,
	).Err(); err != nil {
		fmt.Println("Redis publish error:", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Poll opened successfully",
	})
}