package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {

	// Connect to MongoDB
	err := ConnectMongoDB()
	if err != nil {
		log.Fatal(err)
	}

	// Connect to Redis
	err = ConnectRedis()
	if err != nil {
		log.Fatal(err)
	}

	// Initialize MongoDB collections
	userCollection = MongoClient.Database("hcl_poll").Collection("users")
	pollCollection = MongoClient.Database("hcl_poll").Collection("polls")
	voteCollection = MongoClient.Database("hcl_poll").Collection("votes")

	// Start Redis realtime subscriber
	StartRedisSubscriber()

	router := gin.Default()

	// CORS
	router.Use(func(c *gin.Context) {

		frontendURL := os.Getenv("FRONTEND_URL")

		if frontendURL == "" {
			frontendURL = "http://localhost:5173"
		}

		c.Writer.Header().Set(
			"Access-Control-Allow-Origin",
			frontendURL,
		)

		c.Writer.Header().Set(
			"Access-Control-Allow-Credentials",
			"true",
		)

		c.Writer.Header().Set(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization",
		)

		c.Writer.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, DELETE, OPTIONS",
		)

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// =========================
	// Public routes
	// =========================

	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "HCL Poll backend is running!",
		})
	})

	router.POST("/api/signup", Signup)
	router.POST("/api/login", Login)

	// =========================
	// Protected routes
	// =========================

	protected := router.Group("/api")
	protected.Use(AuthMiddleware())

	// Create poll
	protected.POST("/polls", CreatePoll)

	// Get creator's polls
	protected.GET("/polls", GetMyPolls)

	// Delete poll
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

	// Open/Reopen poll
	protected.POST(
		"/polls/:shareToken/open",
		OpenPoll,
	)

	// =========================
	// Public poll routes
	// =========================

	// Get poll for voters
	router.GET(
		"/api/polls/share/:shareToken",
		GetPollByShareToken,
	)

	// Submit vote
	router.POST(
		"/api/polls/share/:shareToken/vote",
		VotePoll,
	)

	// Get poll results
	router.GET(
		"/api/polls/share/:shareToken/results",
		GetPollResults,
	)

	// WebSocket realtime connection
	router.GET(
		"/api/polls/share/:shareToken/ws",
		HandleWebSocket,
	)

	// =========================
	// Render PORT
	// =========================

	port := os.Getenv("PORT")

	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)

	err = router.Run("0.0.0.0:" + port)
	if err != nil {
		log.Fatal(err)
	}
}
