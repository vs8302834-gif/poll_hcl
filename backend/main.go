package main

import (
	"log"
	"net/http"
	"os"

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

	
	userCollection = MongoClient.Database("hcl_poll").Collection("users")
	pollCollection = MongoClient.Database("hcl_poll").Collection("polls")
	voteCollection = MongoClient.Database("hcl_poll").Collection("votes")

	
	StartRedisSubscriber()

	router := gin.Default()

	
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

	

	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "HCL Poll backend is running!",
		})
	})

	router.POST("/api/signup", Signup)
	router.POST("/api/login", Login)

	

	protected := router.Group("/api")
	protected.Use(AuthMiddleware())

	
	protected.POST("/polls", CreatePoll)

	
	protected.GET("/polls", GetMyPolls)

	
	protected.DELETE("/polls/:shareToken", DeletePoll)

	
	protected.PUT(
		"/polls/:shareToken/expiration",
		ChangePollExpiration,
	)

	
	protected.POST(
		"/polls/:shareToken/close",
		ClosePoll,
	)

	
	protected.POST(
		"/polls/:shareToken/open",
		OpenPoll,
	)

	

	
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
