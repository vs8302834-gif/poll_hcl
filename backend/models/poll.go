package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type PollOption struct {
	ID   string `bson:"id" json:"id"`
	Text string `bson:"text" json:"text"`
}

type Poll struct {
	ID         bson.ObjectID `bson:"_id,omitempty" json:"id"`
	CreatorID  bson.ObjectID `bson:"creatorId" json:"creatorId"`
	Question   string        `bson:"question" json:"question"`
	Options    []PollOption  `bson:"options" json:"options"`
	ExpiresAt  *time.Time    `bson:"expiresAt,omitempty" json:"expiresAt,omitempty"`
	Status     string        `bson:"status" json:"status"`
	ShareToken string        `bson:"shareToken" json:"shareToken"`
	CreatedAt  time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt  time.Time     `bson:"updatedAt" json:"updatedAt"`
}