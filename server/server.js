import 'dotenv/config'; // MUST be first: loads .env before other files read process.env
import http from 'http';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import { connectMongo, disconnectMongo } from './config/db.js';
import { redis, connectRedis, disconnectRedis } from './config/redis.js';
import authRoutes from './routes/auth.js';
import quizRoutes from './routes/quiz.js';
import roomRoutes from './routes/rooms.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { initSocket } from './socket/index.js';

// ---- 1. Fail fast if the environment is misconfigured ----------------------
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET', 'REDIS_URL'];
const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
  console.error('   Copy .env.example to .env and fill them in.');
  process.exit(1);
}

const PORT = process.env.PORT || 3001;
// The React dev server. In production set CLIENT_URL to your deployed client
// (comma-separated if there are several).
const ALLOWED_ORIGINS = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

// ---- 2. Express app --------------------------------------------------------
const app = express();

// CORS: browsers block requests between different origins (5173 -> 3001)
// unless the server explicitly allows it. We allow ONLY our client, not "*".
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json({ limit: '200kb' })); // parse JSON bodies (size-capped)

// Health check: handy for testing, and Railway can use it as a health probe
app.get('/api/health', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1; // 1 = connected
  let redisOk = false;
  try {
    redisOk = (await redis.ping()) === 'PONG';
  } catch {
    redisOk = false;
  }
  const healthy = mongoOk && redisOk;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    mongo: mongoOk ? 'up' : 'down',
    redis: redisOk ? 'up' : 'down',
    uptimeSec: Math.round(process.uptime()),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/rooms', roomRoutes);

// These two MUST come after all routes
app.use(notFound);
app.use(errorHandler);

// ---- 3. Raw HTTP server + Socket.io on the same port -----------------------
const server = http.createServer(app);
const io = initSocket(server, ALLOWED_ORIGINS);

// ---- 4. Start: connect to databases FIRST, then listen ---------------------
async function start() {
  try {
    await connectMongo();
    await connectRedis();
    server.listen(PORT, () => {
      console.log(`🚀 QuizBuzz server running on http://localhost:${PORT}`);
      console.log(`   Allowed client origins: ${ALLOWED_ORIGINS.join(', ')}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

// ---- 5. Graceful shutdown --------------------------------------------------
async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down...`);
  io.close();
  server.close();
  await Promise.allSettled([disconnectMongo(), disconnectRedis()]);
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Last line of defence: log instead of dying silently
process.on('unhandledRejection', (reason) => console.error('❌ Unhandled rejection:', reason));

start();
