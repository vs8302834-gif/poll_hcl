# HCL Poll - Live Polling Application

A real-time polling application where users can create polls, share them with others, collect votes, and view live results without refreshing the page.

## 🚀 Live Demo

Frontend: https://poll-hcl.vercel.app

## 📌 Features

- User signup and login
- JWT-based authentication
- Create polls with multiple options
- Generate a unique shareable poll link
- Allow users to vote through the shared link
- Browser-based duplicate vote prevention
- Real-time vote count and percentage updates
- Live results without page refresh
- Poll expiration
- Close and reopen polls
- Change poll expiration time
- Delete polls
- Responsive user interface

## 🛠️ Tech Stack

### Frontend

- React
- Vite
- JavaScript
- CSS

### Backend

- Go
- Gin Framework
- JWT Authentication
- WebSocket

### Database

- MongoDB Atlas

### Real-Time Communication

- Redis Pub/Sub
- WebSocket

### Deployment

- Vercel - Frontend
- Render - Backend
- MongoDB Atlas - Database
- Redis - Real-time messaging

## 🏗️ Project Structure

```text
HCL_poll/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── models/
│   │   ├── user.go
│   │   ├── poll.go
│   │   └── vote.go
│   ├── auth.go
│   ├── database.go
│   ├── main.go
│   ├── middleware.go
│   ├── poll.go
│   ├── redis.go
│   ├── realtime.go
│   ├── results.go
│   └── vote.go
│
└── README.md
