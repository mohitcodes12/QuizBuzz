# QuizBuzz

A real-time multiplayer quiz platform where users create rooms via shareable codes, compete live with synchronized questions, and battle on a live leaderboard — built with WebSockets, Node.js, and Redis.

**Status:** Feature-complete, deployment in progress
**Stack:** MERN + Socket.io + Redis
**License:** MIT

---

## Live Demo

Coming soon — deployment in progress.

---

## Features

- Create quiz rooms with shareable, unique room codes
- Multiple players join and compete simultaneously
- Server-driven timers — all players receive questions in sync; the client is never trusted for timing
- Live leaderboard with real-time score updates
- Graceful handling of mid-game disconnections, with score and state restored on rejoin
- Fully responsive UI

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | UI framework |
| Tailwind CSS | Styling |
| Socket.io Client | Real-time communication |
| Recharts | Score visualization |

### Backend

| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| Socket.io | WebSocket and game events |
| MongoDB + Mongoose | Quiz and user data |
| Redis (Sorted Sets) | Live leaderboard |

---

## Project Structure

```
quizbuzz/
│
├── client/                  React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Game/        Question, Timer, Options
│   │   │   ├── Room/        Create room, Join room
│   │   │   ├── Leaderboard/ Live scores
│   │   │   └── Auth/        Login, Register
│   │   ├── socket/          Socket.io client setup
│   │   └── App.jsx
│
├── server/                  Node.js backend
│   ├── config/              DB + Redis connection
│   ├── models/              User, Quiz, Room schemas
│   ├── routes/              Auth, Quiz API routes
│   ├── controllers/         Business logic
│   ├── middleware/          JWT verification
│   └── socket/              Game event handlers
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB (local or Atlas)
- Redis (local or cloud)

### Installation

```bash
git clone https://github.com/mohitcodes12/quizbuzz.git
cd quizbuzz

cd server
npm install

cd ../client
npm install
```

### Environment Variables

Create a `.env` file inside `/server`:

```env
PORT=3001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
REDIS_URL=your_redis_url
```

### Run the App

```bash
# Start server (from /server)
npm run dev

# Start client (from /client)
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## How It Works

1. Host creates a room and receives a shareable code.
2. Players join with the code; everyone lands in the lobby.
3. Host starts the game; the server sends Question 1 to all players simultaneously.
4. The timer runs on the server, not the client, so the countdown is fair and cannot be manipulated.
5. Players answer; points are calculated instantly based on correctness and speed.
6. The leaderboard updates live via Redis Sorted Sets.
7. Steps 3–6 repeat for each question, then a winner is announced.

---

## Development Roadmap

- [x] Project setup and folder structure
- [x] User authentication (register/login with JWT)
- [x] Quiz creation and management
- [x] Room creation with shareable codes
- [x] WebSocket integration with Socket.io
- [x] Synchronized question delivery with server timers
- [x] Live leaderboard with Redis Sorted Sets
- [x] Mid-game disconnect and reconnect handling
- [x] Frontend UI with React and Tailwind
- [ ] Deployment (Railway + Vercel)

---

## Contact

**Mohit Kumar Verma**
GitHub: [mohitcodes12](https://github.com/mohitcodes12)
LinkedIn: [mohit-kumar-verma](https://www.linkedin.com/in/mohit-kumar-verma-b45586267/)
Email: mohit.kverma12@gmail.com
