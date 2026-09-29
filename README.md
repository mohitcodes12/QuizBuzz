<<<<<<< HEAD
# QuizBuzz

A real-time multiplayer quiz platform. A host creates a room from a quiz, players join with a 6-character code, and everyone answers the same questions at the same time, timed by the server, with a live leaderboard powered by Redis.

```
quizbuzz/
├── client/    React (Vite) + Tailwind + Socket.io client + Recharts
└── server/    Node.js + Express + Socket.io + MongoDB + Redis
```

## How it works, in plain terms

- **MongoDB is the permanent record.** Users, quizzes, and the final result of each room live here. If the server restarts, this data survives.
- **Redis is the live scoreboard.** While a game is in progress, scores, who's connected, and who has already answered the current question live in Redis, because that data changes many times a second and doesn't need to survive forever (every room key expires automatically after 6 hours).
- **The server is the referee.** It owns the only clock that matters. It decides when a question starts, when it ends, and how many points an answer is worth. A player's browser can lie about anything it wants — the server never trusts it.
- **Socket.io is the live wire.** Once you're in a room, the server pushes questions, leaderboard updates, and the final results to your browser the instant they happen, instead of your browser having to keep asking "anything new?".

## Quick start

You need Node 18+, a MongoDB instance (local or Atlas), and a Redis instance (local or cloud) running before you start.

```bash
# 1. Server
cd server
cp .env.example .env      # then fill in MONGO_URI, JWT_SECRET, REDIS_URL
npm install
npm run dev                # http://localhost:3001

# 2. Client (separate terminal)
cd client
cp .env.example .env       # VITE_API_URL=http://localhost:3001 works locally
npm install
npm run dev                 # http://localhost:5173
```

Open `http://localhost:5173` in two or three browser tabs (or windows) to play a game solo: register two accounts, have one create a quiz and a room, and have the other join with the room code.

### Verifying the server on its own

```bash
curl http://localhost:3001/api/health
# {"status":"ok","mongo":"up","redis":"up","uptimeSec":3}

npm run test:scoring    # pure-logic scoring test, no DB needed
npm run test:e2e        # plays a full 3-player game over real sockets
                         # (needs the server running, with Mongo + Redis up)
```

Tip for a fast `test:e2e` run: start the server with short timers so you don't wait around —
`DISCONNECT_GRACE_MS=3000 RESULT_PAUSE_MS=1200 npm run dev`.

## Feature checklist

- [x] Create quiz rooms with a shareable 6-character code (unique, uppercase, unambiguous alphabet)
- [x] Multiple players join and compete simultaneously
- [x] Server-driven timers — the server clock is the only clock that decides when a question ends
- [x] Live leaderboard via Redis Sorted Sets (`ZINCRBY`, `ZREVRANGE`, `ZREVRANK` — O(log n) per update)
- [x] Graceful disconnect handling — 30s grace period, rejoin restores score and current question
- [x] Host reassignment if the host disconnects mid-game
- [x] Responsive UI (mobile through desktop)
- [x] JWT auth, bcrypt password hashing, protected quiz routes
- [x] Results screen with a Recharts bar chart of final scores

## Socket event contract

**Client → Server:** `room:join {code}`, `room:leave`, `game:start` (host only), `game:answer {questionIndex, optionIndex}`

**Server → Client:** `room:playerList`, `game:question {index, text, options, endsAt}` (never includes `correctIndex`), `game:questionEnd {correctIndex, leaderboard}`, `leaderboard:update`, `game:finished {finalLeaderboard, winner}`, `player:disconnected`, `player:reconnected`, `error`

Sockets authenticate with a JWT sent in the handshake (`io(url, { auth: (cb) => cb({ token }) })` on the client, verified in `server/socket/index.js` before any handler runs).

## Scoring

Correct answer: 1000 base points + up to 500 speed-bonus points, scaled by how much time was left **according to the server's clock** (`server/socket/scoring.js`). Wrong or missing answer: 0. An answer that arrives after the server's deadline is rejected outright, no matter what the client's own timer said.

## Redis key design

```
room:{code}:leaderboard      Sorted Set   member = userId, score = total points
room:{code}:state            Hash         status, currentQuestionIndex, questionEndsAt, hostId
room:{code}:players          Hash         userId -> {username, connected}
room:{code}:answers:{q}      Set          userIds who already answered question q
```

Every key gets a 6-hour TTL when the room is created, and the whole set is deleted immediately once a room empties out or a game finishes — the TTL is just a safety net for abandoned rooms.

## Known limitation, and how you'd fix it

Each running game's timers live in that Node process's memory (`Map` in `server/socket/gameEngine.js`), because a `setTimeout` can't be stored in Redis. That means **one game lives on one server instance** — if you horizontally scale to multiple server processes, players in the same room must all land on the same instance (sticky sessions), or you'd need to move the timer itself into something like a Redis-backed job queue (BullMQ) that any instance can pick up. Everything else (scores, room state, player list) already lives in Redis and is safe to share across instances.

## Deployment notes

**Server → Railway**
1. Push `server/` to GitHub, create a new Railway project from that repo.
2. Add MongoDB and Redis — either Railway's own plugins or your own Atlas/Redis Cloud URLs.
3. Set environment variables from `.env.example` (`MONGO_URI`, `JWT_SECRET`, `REDIS_URL`, and `PORT` if Railway doesn't inject one).
4. Start command: `npm start`. Railway's own health checks can point at `/api/health`.
5. Note your Railway URL — the client needs it next.

**Client → Vercel**
1. Push `client/` to GitHub, import it into Vercel as a Vite project (build command `npm run build`, output directory `dist` — Vercel detects both automatically).
2. Set `VITE_API_URL` to your Railway server URL.
3. Once deployed, go back to the server and update `CLIENT_URL` (or the CORS origin in `server.js`) to your Vercel URL, then redeploy the server — otherwise the browser's CORS check will block every request.

## Interview questions you should be able to answer

1. **Why split data between MongoDB and Redis instead of using one database for everything?** (permanent vs. live, fast-changing data — and what happens if Redis is wiped: you lose nothing permanent, just the in-progress game.)
2. **Why can the server never trust a client's own countdown timer, and where in this codebase is that enforced?** (`gameEngine.js` computes `remainingMs` from its own `endsAt` timestamp, and rejects any answer that arrives after it — see `handleAnswer`.)
3. **Walk through what happens, step by step, if a player's WiFi drops for 10 seconds mid-question.** (marked disconnected, score kept in Redis, grace timer starts, they reconnect before it fires, state and current question are restored, no points lost or gained unfairly.)
4. **Why is a Redis Sorted Set the right structure for a leaderboard, instead of just querying MongoDB and sorting there?** (`ZINCRBY`/`ZREVRANGE`/`ZREVRANK` are O(log n), the whole thing stays in memory, and it's built for exactly "keep a ranked set updated constantly" — MongoDB would mean a table scan and re-sort on every single point scored, for every player, on every question.)
5. **What's the one architectural limitation you'd flag to a senior engineer reviewing this?** (see "Known limitation" above — game timers are in-process memory, so this doesn't horizontally scale without sticky sessions or a distributed job queue.)
=======
# ⚡ QuizBuzz

A real-time multiplayer quiz platform where users create rooms via 
shareable codes, compete live with synchronized questions, and 
battle it out on a live leaderboard — built with WebSockets, 
Node.js, and Redis.

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow)
![Tech](https://img.shields.io/badge/Stack-MERN%20%2B%20Socket.io%20%2B%20Redis-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🚀 Live Demo
> Coming soon — deployment in progress

---

## ✨ Features

- 🏠 Create quiz rooms with shareable room codes
- 👥 Multiple players join and compete simultaneously
- ⏱️ Server-driven timers — all players get questions in sync
- 🏆 Live leaderboard with real-time score updates
- 🔄 Graceful handling of mid-game disconnections
- 📱 Fully responsive UI

---

## 🛠️ Tech Stack

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
| Socket.io | WebSocket + game events |
| MongoDB + Mongoose | Quiz and user data |
| Redis Sorted Sets | Live leaderboard |

---

## 📁 Project Structure
quizbuzz/
│
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Game/        # Question, Timer, Options
│   │   │   ├── Room/        # Create room, Join room
│   │   │   ├── Leaderboard/ # Live scores
│   │   │   └── Auth/        # Login, Register
│   │   ├── socket/          # Socket.io client setup
│   │   └── App.jsx
│
├── server/                  # Node.js backend
│   ├── config/              # DB + Redis connection
│   ├── models/              # User, Quiz, Room schemas
│   ├── routes/              # Auth, Quiz API routes
│   ├── controllers/         # Business logic
│   ├── middleware/          # JWT verification
│   └── socket/              # Game event handlers

---

## ⚙️ Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Redis (local or cloud)

### Installation

```bash
# Clone the repo
git clone https://github.com/mohitcodes12/quizbuzz.git
cd quizbuzz

# Install server dependencies
cd server
npm install

# Install client dependencies
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

## 🎮 How It Works
Host creates room → Gets shareable code
↓
Players join with code → All land in lobby
↓
Host starts game → Server sends Question 1 to ALL players
↓
Timer runs on SERVER (not client) → Fair for everyone
↓
Players answer → Points calculated instantly
↓
Leaderboard updates live via Redis Sorted Sets
↓
Repeat for all questions → Winner announced

---

## 🗺️ Development Roadmap

- [x] Project setup and folder structure
- [ ] User authentication (Register/Login with JWT)
- [ ] Quiz creation and management
- [ ] Room creation with shareable codes
- [ ] WebSocket integration with Socket.io
- [ ] Synchronized question delivery with server timers
- [ ] Live leaderboard with Redis Sorted Sets
- [ ] Mid-game disconnect and reconnect handling
- [ ] Frontend UI with React + Tailwind
- [ ] Deployment (Railway + Vercel)

---

## 📸 Screenshots
> Coming soon

---

## 🤝 Connect

**Mohit Kumar Verma**
- GitHub: [@mohitcodes12](https://github.com/mohitcodes12)
- LinkedIn: [mohit-kumar-verma](https://www.linkedin.com/in/mohit-kumar-verma-b45586267/)
- Email: mohit.kverma12@gmail.com

---

> ⭐ Star this repo if you find it interesting!
>>>>>>> f832ae5b12701798f3ee11a5200bc852fb7df186
