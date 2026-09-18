package main

import (
	"context"
	"net/http"
	"time"

	"HCL_poll/backend/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type OptionResult struct {
	OptionID   string  `json:"optionId"`
	Text       string  `json:"text"`
	VoteCount  int64   `json:"voteCount"`
	Percentage float64 `json:"percentage"`
}

type PollResults struct {
	TotalVotes int64         `json:"totalVotes"`
	Winner     *OptionResult `json:"winner"`
	Options    []OptionResult `json:"options"`
}

func BuildPollResults(shareToken string) (*PollResults, error) {

	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	var poll models.Poll

	err := pollCollection.FindOne(
		ctx,
		bson.M{"shareToken": shareToken},
	).Decode(&poll)

	if err != nil {
		return nil, err
	}

	results := make([]OptionResult, 0)

	var totalVotes int64

	// ==================================================
	// COUNT VOTES FOR EVERY OPTION
	// ==================================================

	for _, option := range poll.Options {

		count, err := voteCollection.CountDocuments(
			ctx,
			bson.M{
				"pollId":   poll.ID,
				"optionId": option.ID,
			},
		)

		if err != nil {
			return nil, err
		}

		totalVotes += count

		results = append(results, OptionResult{
			OptionID:  option.ID,
			Text:      option.Text,
			VoteCount: count,
			Percentage: 0,
		})
	}

	// ==================================================
	// CALCULATE PERCENTAGES
	// ==================================================

	for i := range results {

		if totalVotes > 0 {
			results[i].Percentage =
				float64(results[i].VoteCount) /
					float64(totalVotes) *
					100
		} else {
			results[i].Percentage = 0
		}
	}

	// ==================================================
	// FIND WINNER
	// ==================================================

	var winner *OptionResult

	for i := range results {

		if winner == nil ||
			results[i].VoteCount > winner.VoteCount {

			winner = &results[i]
		}
	}

	// No winner when there are no votes
	if totalVotes == 0 {
		winner = nil
	}

	return &PollResults{
		TotalVotes: totalVotes,
		Winner:     winner,
		Options:    results,
	}, nil
}

// ==================================================
// GET POLL RESULTS
// ==================================================

func GetPollResults(c *gin.Context) {

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

	// ==================================================
	// GET POLL
	// ==================================================

	var poll models.Poll

	err := pollCollection.FindOne(
		ctx,
		bson.M{"shareToken": shareToken},
	).Decode(&poll)

	if err != nil {

		if err.Error() == "mongo: no documents in result" {
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

	// ==================================================
	// AUTOMATICALLY MARK EXPIRED
	// ==================================================

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

	// ==================================================
	// BUILD RESULTS
	// ==================================================

	results, err := BuildPollResults(shareToken)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to build poll results",
		})
		return
	}

	// ==================================================
	// RESPONSE
	// ==================================================

	c.JSON(http.StatusOK, gin.H{

		"poll": gin.H{
			"id":         poll.ID,
			"question":   poll.Question,
			"expiresAt":  poll.ExpiresAt,
			"status":     poll.Status,
			"shareToken": poll.ShareToken,
		},

		"totalVotes": results.TotalVotes,

		"winner": results.Winner,

		// Frontend expects "results"
		"results": results.Options,

		// Keep "options" too for compatibility
		"options": results.Options,
	})
}