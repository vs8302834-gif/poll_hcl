package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {

	err := ConnectMongoDB()
	if err != nil {
		log.Fatal(err)
	}

	err = ConnectRedis()
	if err != nil {
		log.Fatal(err)
	}

	StartRedisSubscriber()

	userCollection = MongoClient.Database("hcl_poll").Collection("users")
	pollCollection = MongoClient.Database("hcl_poll").Collection("polls")
	voteCollection = MongoClient.Database("hcl_poll").Collection("votes")

	router := gin.Default()

	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// Public routes
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "HCL Poll backend is running!",
		})
	})

	router.POST("/api/signup", Signup)
	router.POST("/api/login", Login)

	// Protected routes
	protected := router.Group("/api")
	protected.Use(AuthMiddleware())

	protected.POST("/polls", CreatePoll)
	protected.GET("/polls", GetMyPolls)
	protected.DELETE("/polls/:shareToken", DeletePoll)

	// Change poll expiration
	protected.PUT(
		"/polls/:shareToken/expiration",
		ChangePollExpiration,
	)

	// Close poll
	protected.POST(
		"/polls/:shareToken/close",
		ClosePoll,
	)

	// Public poll routes
	router.GET(
		"/api/polls/share/:shareToken",
		GetPollByShareToken,
	)

	router.POST(
		"/api/polls/share/:shareToken/vote",
		VotePoll,
	)

	router.GET(
		"/api/polls/share/:shareToken/results",
		GetPollResults,
	)

	router.GET(
		"/api/polls/share/:shareToken/ws",
		HandleWebSocket,
	)


	protected.POST(
		"/polls/:shareToken/open",
		OpenPoll,
	)




	router.Run(":8080")
}