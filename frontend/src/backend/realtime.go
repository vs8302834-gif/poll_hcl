package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"HCL_poll/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// ==================================================
// WEBSOCKET CONFIGURATION
// ==================================================

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// ==================================================
// CONNECTED WEBSOCKET CLIENTS
// ==================================================

var clients = make(map[string]map[*websocket.Conn]bool)
var clientsMutex sync.Mutex

// ==================================================
// WEBSOCKET CONNECTION
// ==================================================

func HandleWebSocket(c *gin.Context) {

	shareToken := c.Param("shareToken")

	// -----------------------------------
	// CHECK POLL EXISTS
	// -----------------------------------

	var poll models.Poll

	err := pollCollection.FindOne(
		context.Background(),
		bson.M{
			"shareToken": shareToken,
		},
	).Decode(&poll)

	if err != nil {

		c.JSON(http.StatusNotFound, gin.H{
			"error": "Poll not found",
		})

		return
	}

	// -----------------------------------
	// UPGRADE HTTP CONNECTION TO WEBSOCKET
	// -----------------------------------

	conn, err := upgrader.Upgrade(
		c.Writer,
		c.Request,
		nil,
	)

	if err != nil {

		fmt.Println(
			"WebSocket upgrade error:",
			err,
		)

		return
	}

	fmt.Println(
		"WebSocket connected:",
		shareToken,
	)

	// -----------------------------------
	// ADD CLIENT TO POLL'S CLIENT LIST
	// -----------------------------------

	clientsMutex.Lock()

	if clients[shareToken] == nil {
		clients[shareToken] = make(map[*websocket.Conn]bool)
	}

	clients[shareToken][conn] = true

	clientsMutex.Unlock()

	// -----------------------------------
	// REMOVE CLIENT WHEN DISCONNECTED
	// -----------------------------------

	defer func() {

		clientsMutex.Lock()

		delete(
			clients[shareToken],
			conn,
		)

		if len(clients[shareToken]) == 0 {
			delete(clients, shareToken)
		}

		clientsMutex.Unlock()

		conn.Close()

		fmt.Println(
			"WebSocket disconnected:",
			shareToken,
		)

	}()

	// -----------------------------------
	// KEEP CONNECTION ALIVE
	// -----------------------------------

	for {

		_, _, err := conn.ReadMessage()

		if err != nil {
			break
		}
	}
}

// ==================================================
// BROADCAST DATA TO CONNECTED CLIENTS
// ==================================================

func BroadcastPollResults(
	shareToken string,
	data interface{},
) {

	// -----------------------------------
	// CONVERT DATA TO JSON
	// -----------------------------------

	message, err := json.Marshal(data)

	if err != nil {

		fmt.Println(
			"WebSocket JSON error:",
			err,
		)

		return
	}

	// -----------------------------------
	// LOCK CLIENT LIST
	// -----------------------------------

	clientsMutex.Lock()
	defer clientsMutex.Unlock()

	fmt.Println(
		"Broadcasting realtime update:",
		shareToken,
		"connected clients:",
		len(clients[shareToken]),
	)

	// -----------------------------------
	// SEND UPDATE TO ALL CLIENTS
	// -----------------------------------

	for conn := range clients[shareToken] {

		err := conn.WriteMessage(
			websocket.TextMessage,
			message,
		)

		if err != nil {

			fmt.Println(
				"WebSocket write error:",
				err,
			)

			conn.Close()

			delete(
				clients[shareToken],
				conn,
			)
		}
	}
}

// ==================================================
// REDIS SUBSCRIBER
// ==================================================

func StartRedisSubscriber() {

	go func() {

		ctx := context.Background()

		// -----------------------------------
		// SUBSCRIBE TO ALL POLL CHANNELS
		// -----------------------------------

		pubsub := RedisClient.PSubscribe(
			ctx,
			"poll:*",
		)

		defer pubsub.Close()

		fmt.Println(
			"Redis subscriber started",
		)

		fmt.Println(
			"Listening for channels: poll:*",
		)

		// -----------------------------------
		// LISTEN FOR REDIS EVENTS
		// -----------------------------------

		for {

			message, err := pubsub.ReceiveMessage(ctx)

			if err != nil {

				fmt.Println(
					"Redis subscriber error:",
					err,
				)

				continue
			}

			fmt.Println(
				"Redis event received:",
				message.Channel,
				"payload:",
				message.Payload,
			)

			// -----------------------------------
			// GET SHARE TOKEN FROM CHANNEL
			// -----------------------------------

			shareToken := strings.TrimPrefix(
				message.Channel,
				"poll:",
			)

			if shareToken == "" {

				fmt.Println(
					"Invalid Redis channel",
				)

				continue
			}

			// -----------------------------------
			// GET CURRENT POLL FROM MONGODB
			// -----------------------------------

			var poll models.Poll

			err = pollCollection.FindOne(
				ctx,
				bson.M{
					"shareToken": shareToken,
				},
			).Decode(&poll)

			if err != nil {

				fmt.Println(
					"Failed to fetch poll for realtime update:",
					err,
				)

				continue
			}

			// -----------------------------------
			// AUTOMATIC EXPIRATION
			// -----------------------------------

			if poll.Status == "active" &&
				poll.ExpiresAt != nil {

				if time.Now().After(*poll.ExpiresAt) {

					poll.Status = "expired"

					_, err = pollCollection.UpdateOne(
						ctx,
						bson.M{
							"_id": poll.ID,
						},
						bson.M{
							"$set": bson.M{
								"status": "expired",
							},
						},
					)

					if err != nil {

						fmt.Println(
							"Failed to mark poll expired:",
							err,
						)

						continue
					}
				}
			}

			// -----------------------------------
			// BUILD LATEST POLL RESULTS
			// -----------------------------------

			results, err := BuildPollResults(
				shareToken,
			)

			if err != nil {

				fmt.Println(
					"Failed to build realtime results:",
					err,
				)

				continue
			}

			// -----------------------------------
			// PREPARE WEBSOCKET RESPONSE
			// -----------------------------------

			websocketData := map[string]interface{}{

				"poll": map[string]interface{}{
					"status":    poll.Status,
					"expiresAt": poll.ExpiresAt,
				},

				"results": results.Options,

				"totalVotes": results.TotalVotes,
			}

			fmt.Println(
				"Sending realtime update:",
				shareToken,
				"status:",
				poll.Status,
			)

			// -----------------------------------
			// BROADCAST UPDATE
			// -----------------------------------

			BroadcastPollResults(
				shareToken,
				websocketData,
			)
		}
	}()
}