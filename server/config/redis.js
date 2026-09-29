import Redis from 'ioredis';

// NOTE: this file reads process.env.REDIS_URL when imported, so server.js
// must import 'dotenv/config' BEFORE importing this file.

// lazyConnect: true -> the client does NOT connect until we call connectRedis().
// That lets us control startup order and fail fast if Redis is down.
export const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

// Without an 'error' listener, a Redis hiccup would crash the whole process
redis.on('error', (err) => console.error('❌ Redis error:', err.message));

export async function connectRedis() {
  await redis.connect();
  await redis.ping(); // proves the connection actually works
  console.log('✅ Redis connected');
}

export async function disconnectRedis() {
  await redis.quit();
}

// ---------------------------------------------------------------------------
// REDIS KEY DESIGN (one place, so we never mistype a key string)
//
//  room:{code}:leaderboard    Sorted Set  member = userId, score = points
//  room:{code}:state          Hash        status, phase, currentQuestionIndex,
//                                         questionEndsAt, hostId, startedAt
//  room:{code}:answers:{q}    Set         userIds who already answered
//                                         question q (blocks double answers)
//  room:{code}:players        Hash        userId -> JSON {username, connected,
//                                         joinedAt}   (small addition: we need
//                                         usernames + connection status)
// ---------------------------------------------------------------------------
export const keys = {
  leaderboard: (code) => `room:${code}:leaderboard`,
  state: (code) => `room:${code}:state`,
  answers: (code, qIndex) => `room:${code}:answers:${qIndex}`,
  // Used with SCAN (not KEYS, which blocks Redis) to find every
  // answers:* key for a room when cleaning it up.
  answersPattern: (code) => `room:${code}:answers:*`,
  players: (code) => `room:${code}:players`,
};

// Every room key expires after 6 hours, so abandoned games can't fill Redis
export const ROOM_TTL_SECONDS = 6 * 60 * 60;
