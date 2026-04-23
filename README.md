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
