package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

var MongoClient *mongo.Client

func ConnectMongoDB() error {
	
	_ = godotenv.Load()

	
	uri := os.Getenv("MONGO_URI")

	if uri == "" {
		return fmt.Errorf("MONGO_URI is not set in environment variables")
	}

	
	serverAPI := options.ServerAPI(options.ServerAPIVersion1)

	opts := options.Client().
		ApplyURI(uri).
		SetServerAPIOptions(serverAPI)

	var err error

	MongoClient, err = mongo.Connect(opts)

	if err != nil {
		return fmt.Errorf("failed to create MongoDB client: %v", err)
	}

	
	ctx, cancel := context.WithTimeout(
		context.Background(),
		10*time.Second,
	)
	defer cancel()

	err = MongoClient.Ping(ctx, nil)

	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %v", err)
	}

	fmt.Println("MongoDB connected successfully!")

	return nil
}
