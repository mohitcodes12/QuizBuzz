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
