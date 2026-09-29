import Room from '../models/Room.js';
import { redis, keys, ROOM_TTL_SECONDS } from '../config/redis.js';
import { calculateScore } from './scoring.js';

// ---------------------------------------------------------------------------
// TUNABLES
// ---------------------------------------------------------------------------
const GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS) || 30_000; // spec: 30s
const RESULT_PAUSE_MS = Number(process.env.RESULT_PAUSE_MS) || 5_000; // answer reveal time
// The question timer fires a little AFTER endsAt so answers that arrived just
// before the deadline (and are still being processed) are not cut off.
// Answers are still judged by the moment they ARRIVED, so this gives nobody extra time.
const END_GRACE_MS = 250;

// ---------------------------------------------------------------------------
// IN-MEMORY STATE (per server process)
//
// Redis holds the shared "truth" (scores, status, who answered).
// Timers can't live in Redis, so each running game also has an in-memory
// object holding its setTimeout handle and the questions.
// Trade-off: one game lives on ONE server instance. Scaling to many instances
// would need sticky sessions or a distributed job queue (see README roadmap).
// ---------------------------------------------------------------------------
/** code -> { questions, phase, questionIndex, timer, results: Map, lastEnd } */
const games = new Map();
/** `${code}:${userId}` -> Timeout   (disconnect grace timers) */
const graceTimers = new Map();
/** `${code}:${userId}` -> socket.id (the ONE live socket of that player) */
const userSockets = new Map();

export class GameError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const mapKey = (code, userId) => `${code}:${userId}`;

// ---------------------------------------------------------------------------
// REDIS READ HELPERS
// ---------------------------------------------------------------------------
async function getPlayers(code) {
  const raw = await redis.hgetall(keys.players(code));
  return Object.entries(raw)
    .map(([userId, json]) => ({ userId, ...JSON.parse(json) }))
    .sort((a, b) => a.joinedAt - b.joinedAt); // stable "join order"
}

// ZREVRANGE = "reverse range": highest score first. O(log n + m).
async function getLeaderboard(code) {
  const [flat, players] = await Promise.all([
    redis.zrevrange(keys.leaderboard(code), 0, -1, 'WITHSCORES'),
    getPlayers(code),
  ]);
  const byId = new Map(players.map((p) => [p.userId, p]));
  const board = [];
  // WITHSCORES returns a flat array: [member, score, member, score, ...]
  for (let i = 0; i < flat.length; i += 2) {
    const userId = flat[i];
    const p = byId.get(userId);
    board.push({
      rank: i / 2 + 1,
      userId,
      username: p?.username ?? 'Unknown',
      score: Number(flat[i + 1]),
      connected: p?.connected ?? false,
    });
  }
  return board;
}

// ---------------------------------------------------------------------------
// BROADCAST HELPERS
// ---------------------------------------------------------------------------
async function broadcastPlayerList(io, code) {
  const [state, players] = await Promise.all([redis.hgetall(keys.state(code)), getPlayers(code)]);
  io.to(code).emit('room:playerList', {
    code,
    status: state.status,
    hostId: state.hostId,
    players: players.map((p) => ({
      userId: p.userId,
      username: p.username,
      connected: p.connected,
      isHost: p.userId === state.hostId,
    })),
  });
}

async function broadcastLeaderboard(io, code) {
  io.to(code).emit('leaderboard:update', { leaderboard: await getLeaderboard(code) });
}

// SECURITY: this is the ONLY place a question is turned into a client payload,
// and it deliberately leaves out correctIndex.
function questionPayload(game, index, endsAt) {
  const q = game.questions[index];
  return {
    index,
    total: game.questions.length,
    text: q.text,
    options: q.options,
    timeLimitSec: q.timeLimitSec,
    endsAt, // absolute server timestamp (ms)
    serverNow: Date.now(), // lets the client correct for its own clock being wrong
  };
}

// ---------------------------------------------------------------------------
// JOIN / REJOIN
// ---------------------------------------------------------------------------
export async function joinRoom(io, socket, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new GameError('BAD_CODE', 'Room codes are 6 characters');

  const { id: userId, username } = socket.data.user;

  const state = await redis.hgetall(keys.state(code));
  if (!state.status) throw new GameError('ROOM_NOT_FOUND', 'Room not found or expired');

  const existingRaw = await redis.hget(keys.players(code), userId);
  const existing = existingRaw ? JSON.parse(existingRaw) : null;

  if (state.status === 'finished') throw new GameError('ROOM_FINISHED', 'This game has finished');
  // Late joiners are blocked once the game starts. Only people who were ALREADY
  // in the room can come back (that is the rejoin path).
  if (state.status === 'active' && !existing) {
    throw new GameError('ROOM_STARTED', 'This game has already started');
  }
  if (state.status === 'active' && !games.has(code)) {
    throw new GameError('ROOM_UNAVAILABLE', 'This game is no longer running (server restarted)');
  }

  // If this socket was in another room, leave it first
  if (socket.data.roomCode && socket.data.roomCode !== code) await leaveRoom(io, socket);

  // Same user, second tab/device: the newest connection wins, the old one is kicked out
  const key = mapKey(code, userId);
  const oldSocketId = userSockets.get(key);
  if (oldSocketId && oldSocketId !== socket.id) {
    const old = io.sockets.sockets.get(oldSocketId);
    if (old) {
      old.leave(code);
      old.data.roomCode = null;
      old.emit('error', { code: 'REPLACED', message: 'You joined this room from another tab' });
    }
  }
  userSockets.set(key, socket.id);

  // Coming back within the grace period? Cancel the "remove this player" timer.
  cancelGrace(key);

  const wasDisconnected = existing && !existing.connected;

  socket.join(code); // Socket.io "room": lets us broadcast with io.to(code)
  socket.data.roomCode = code;

  const playersKey = keys.players(code);
  const lbKey = keys.leaderboard(code);
  await redis
    .multi()
    .hset(playersKey, userId, JSON.stringify({ username, connected: true, joinedAt: existing?.joinedAt ?? Date.now() }))
    // ZADD ... NX = "only add if the member does NOT exist yet".
    // A brand-new player enters at 0 points; a REJOINING player keeps their score.
    .zadd(lbKey, 'NX', 0, userId)
    .expire(playersKey, ROOM_TTL_SECONDS)
    .expire(lbKey, ROOM_TTL_SECONDS)
    .expire(keys.state(code), ROOM_TTL_SECONDS)
    .exec();

  // Permanent record in Mongo (only added once per user)
  await Room.updateOne(
    { code, 'players.user': { $ne: userId } },
    { $push: { players: { user: userId, username } } }
  ).catch((err) => console.error('❌ Could not record player in Mongo:', err.message));

  await broadcastPlayerList(io, code);
  if (wasDisconnected) {
    socket.to(code).emit('player:reconnected', { userId, username });
  }

  // REJOIN: bring this client up to date with whatever is happening right now
  if (state.status === 'active') await sendCurrentState(socket, code, userId);
}

// Sends a (re)joining player the current question/reveal + leaderboard
async function sendCurrentState(socket, code, userId) {
  const game = games.get(code);
  if (!game) return;

  if (game.phase === 'question') {
    const alreadyAnswered = await redis.sismember(keys.answers(code, game.questionIndex), userId);
    socket.emit('game:question', {
      ...questionPayload(game, game.questionIndex, game.endsAt),
      answered: alreadyAnswered === 1,
    });
  } else if (game.phase === 'results' && game.lastEnd) {
    socket.emit('game:questionEnd', game.lastEnd);
  }
  socket.emit('leaderboard:update', { leaderboard: await getLeaderboard(code) });
}

// ---------------------------------------------------------------------------
// START GAME (host only)
// ---------------------------------------------------------------------------
export async function startGame(io, socket) {
  const code = socket.data.roomCode;
  if (!code) throw new GameError('NOT_IN_ROOM', 'Join a room first');

  const state = await redis.hgetall(keys.state(code));
  // Authorization uses the SERVER's record of who the host is, never the client's claim
  if (state.hostId !== socket.data.user.id) {
    throw new GameError('NOT_HOST', 'Only the host can start the game');
  }
  if (state.status !== 'lobby' || games.has(code)) {
    throw new GameError('ALREADY_STARTED', 'The game has already started');
  }

  const room = await Room.findOne({ code }).populate('quiz');
  if (!room || !room.quiz) throw new GameError('QUIZ_MISSING', 'The quiz for this room no longer exists');

  const questions = room.quiz.questions.map((q) => ({
    text: q.text,
    options: [...q.options],
    correctIndex: q.correctIndex,
    timeLimitSec: q.timeLimitSec,
  }));

  games.set(code, {
    questions,
    phase: 'starting',
    questionIndex: -1,
    endsAt: 0,
    timer: null,
    results: new Map(),
    lastEnd: null,
  });

  await redis.hset(keys.state(code), { status: 'active', currentQuestionIndex: -1 });
  await Room.updateOne({ code }, { status: 'active' });

  await broadcastPlayerList(io, code); // status is now "active": clients leave the lobby
  await sendQuestion(io, code, 0);
}

// ---------------------------------------------------------------------------
// SERVER-DRIVEN TIMER
//
// The server decides WHEN a question starts and ends. The client only
// displays a countdown. Flow for every question:
//   1. endsAt = now + timeLimit  (server clock)
//   2. save endsAt in Redis + emit game:question to everyone at the same moment
//   3. setTimeout(endQuestion) fires when time is up (or earlier if everybody answered)
//   4. show the reveal for RESULT_PAUSE_MS, then go to the next question
// ---------------------------------------------------------------------------
async function sendQuestion(io, code, index) {
  const game = games.get(code);
  if (!game) return;

  const q = game.questions[index];
  const endsAt = Date.now() + q.timeLimitSec * 1000;

  game.phase = 'question';
  game.questionIndex = index;
  game.endsAt = endsAt;
  game.results = new Map();

  await redis
    .multi()
    .hset(keys.state(code), { currentQuestionIndex: index, questionEndsAt: endsAt })
    .expire(keys.state(code), ROOM_TTL_SECONDS)
    .exec();

  io.to(code).emit('game:question', questionPayload(game, index, endsAt));

  game.timer = setTimeout(
    () => endQuestion(io, code, index).catch((err) => console.error('❌ endQuestion:', err)),
    Math.max(0, endsAt - Date.now()) + END_GRACE_MS
  );
}

async function endQuestion(io, code, index) {
  const game = games.get(code);
  // Guard: makes this function run at most ONCE per question, even if the
  // timer and the "everyone answered" shortcut both try to end it.
  if (!game || game.phase !== 'question' || game.questionIndex !== index) return;
  game.phase = 'results';
  clearTimeout(game.timer);

  // questionEndsAt = 0 means "no question is accepting answers"
  await redis.hset(keys.state(code), 'questionEndsAt', 0);

  const q = game.questions[index];
  const answerCounts = [0, 0, 0, 0];
  const results = {};
  for (const [userId, r] of game.results) {
    answerCounts[r.optionIndex]++;
    results[userId] = r; // { optionIndex, points }
  }

  const isLast = index === game.questions.length - 1;
  const payload = {
    index,
    correctIndex: q.correctIndex, // <- the ONLY moment the answer is revealed
    leaderboard: await getLeaderboard(code),
    answerCounts,
    results,
    isLast,
  };
  game.lastEnd = payload;
  io.to(code).emit('game:questionEnd', payload);

  game.timer = setTimeout(() => {
    const next = isLast ? finishGame(io, code) : sendQuestion(io, code, index + 1);
    next.catch((err) => console.error('❌ advance game:', err));
  }, RESULT_PAUSE_MS);
}

async function finishGame(io, code) {
  const game = games.get(code);
  if (!game) return;
  clearTimeout(game.timer);

  await redis.hset(keys.state(code), { status: 'finished', questionEndsAt: 0 });

  const finalLeaderboard = await getLeaderboard(code);
  const winner = finalLeaderboard[0] || null;
  io.to(code).emit('game:finished', { finalLeaderboard, winner });
  await broadcastPlayerList(io, code);

  // Save final scores permanently in Mongo
  const room = await Room.findOne({ code });
  if (room) {
    const scoreById = new Map(finalLeaderboard.map((e) => [e.userId, e.score]));
    room.status = 'finished';
    room.players.forEach((p) => {
      p.score = scoreById.get(p.user.toString()) ?? 0;
    });
    await room.save();
  }

  games.delete(code); // free memory; Redis keys expire by TTL or when the room empties
}

// ---------------------------------------------------------------------------
// ANSWERS
// ---------------------------------------------------------------------------
export async function handleAnswer(io, socket, payload) {
  // Take the timestamp FIRST, before any await. Our own Redis latency must not
  // be counted against the player, and we never use any client-sent time.
  const now = Date.now();

  const { questionIndex, optionIndex } = payload || {};
  if (!Number.isInteger(questionIndex) || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
    throw new GameError('BAD_ANSWER', 'Invalid answer');
  }

  const code = socket.data.roomCode;
  if (!code) throw new GameError('NOT_IN_ROOM', 'Join a room first');
  const userId = socket.data.user.id;

  const game = games.get(code);
  if (!game || game.phase !== 'question' || game.questionIndex !== questionIndex) {
    throw new GameError('ANSWER_CLOSED', 'That question is not accepting answers');
  }

  // Redis is the source of truth for the deadline
  const [idx, endsAtRaw] = await redis.hmget(keys.state(code), 'currentQuestionIndex', 'questionEndsAt');
  const endsAt = Number(endsAtRaw);
  if (Number(idx) !== questionIndex || !endsAt || now >= endsAt) {
    throw new GameError('TOO_LATE', 'Time is up');
  }

  if (!(await redis.hexists(keys.players(code), userId))) {
    throw new GameError('NOT_IN_ROOM', 'You are not part of this game');
  }

  // DOUBLE-ANSWER GUARD. SADD is atomic and returns 1 if the member was NEW,
  // 0 if it already existed. Even if a cheater fires 10 answers at the same
  // millisecond, Redis lets exactly ONE through.
  const answersKey = keys.answers(code, questionIndex);
  const [[, added]] = await redis.multi().sadd(answersKey, userId).expire(answersKey, ROOM_TTL_SECONDS).exec();
  if (added === 0) throw new GameError('ALREADY_ANSWERED', 'You already answered this question');

  const q = game.questions[questionIndex];
  const isCorrect = optionIndex === q.correctIndex;
  const points = calculateScore({ isCorrect, remainingMs: endsAt - now, totalMs: q.timeLimitSec * 1000 });

  game.results.set(userId, { optionIndex, points });

  // ZINCRBY = atomic "add points to this member's score". O(log n).
  // Sorted sets keep members ordered by score automatically, so the
  // leaderboard is always sorted with no extra work.
  if (points > 0) await redis.zincrby(keys.leaderboard(code), points, userId);

  // Only an acknowledgement here. Whether it was right is revealed at questionEnd.
  socket.emit('game:answerAck', { questionIndex });
  if (points > 0) await broadcastLeaderboard(io, code);

  // Everyone who is connected has answered? Don't make them wait for the clock.
  const [answered, players] = await Promise.all([redis.scard(answersKey), getPlayers(code)]);
  const connected = players.filter((p) => p.connected).length;
  if (answered >= connected) await endQuestion(io, code, questionIndex);
}

// ---------------------------------------------------------------------------
// LEAVING, DISCONNECTS, GRACE PERIOD, HOST REASSIGNMENT, CLEANUP
// ---------------------------------------------------------------------------
function cancelGrace(key) {
  const t = graceTimers.get(key);
  if (t) {
    clearTimeout(t);
    graceTimers.delete(key);
  }
}

// Player pressed "Leave": intentional, so no grace period.
export async function leaveRoom(io, socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const { id: userId, username } = socket.data.user;

  socket.leave(code);
  socket.data.roomCode = null;
  const key = mapKey(code, userId);
  if (userSockets.get(key) === socket.id) userSockets.delete(key);

  await markDisconnected(io, code, userId, username, 0);
  await finalizeDeparture(io, code, userId);
}

// Connection dropped (closed tab, lost wifi...): start the grace period.
export async function handleDisconnect(io, socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const { id: userId, username } = socket.data.user;
  const key = mapKey(code, userId);

  // If a newer socket already replaced this one (refresh / second tab), ignore
  if (userSockets.get(key) !== socket.id) return;
  userSockets.delete(key);

  await markDisconnected(io, code, userId, username, GRACE_MS);

  // After GRACE_MS, if they have not come back, they are treated as gone.
  cancelGrace(key);
  graceTimers.set(
    key,
    setTimeout(() => {
      graceTimers.delete(key);
      finalizeDeparture(io, code, userId).catch((err) => console.error('❌ finalizeDeparture:', err));
    }, GRACE_MS)
  );
}

// Mark "disconnected" but KEEP the score (the leaderboard entry is untouched)
async function markDisconnected(io, code, userId, username, graceMs) {
  const raw = await redis.hget(keys.players(code), userId);
  if (!raw) return;
  const player = JSON.parse(raw);
  player.connected = false;
  await redis.hset(keys.players(code), userId, JSON.stringify(player));

  io.to(code).emit('player:disconnected', { userId, username, graceMs });
  await broadcastPlayerList(io, code);
}

// Runs when the grace period ends (or immediately on an explicit leave).
async function finalizeDeparture(io, code, userId) {
  const state = await redis.hgetall(keys.state(code));
  if (!state.status) return; // room already cleaned up

  const raw = await redis.hget(keys.players(code), userId);
  if (!raw) return;
  if (JSON.parse(raw).connected) return; // they came back in time: nothing to do

  // In the LOBBY a departed player is removed completely.
  // During a GAME we keep them + their score, so they can still rejoin later
  // and the leaderboard stays complete.
  if (state.status === 'lobby') {
    await redis.multi().hdel(keys.players(code), userId).zrem(keys.leaderboard(code), userId).exec();
  }

  const connected = (await getPlayers(code)).filter((p) => p.connected);

  // Nobody left -> clean up the whole room
  if (connected.length === 0) {
    await cleanupRoom(code);
    return;
  }

  // Host left -> the longest-present connected player becomes host
  if (state.hostId === userId) {
    await redis.hset(keys.state(code), 'hostId', connected[0].userId);
  }

  await broadcastPlayerList(io, code);
}

// Several players' grace timers can expire at the same moment and all reach
// cleanupRoom. This set makes sure the cleanup runs only once per room.
const cleaning = new Set();

// Deletes every trace of a room: timers, memory, Redis keys
async function cleanupRoom(code) {
  if (cleaning.has(code)) return;
  cleaning.add(code);
  try {
    await doCleanup(code);
  } finally {
    cleaning.delete(code);
  }
}

async function doCleanup(code) {
  const game = games.get(code);
  if (game) clearTimeout(game.timer);
  games.delete(code);

  for (const [k, t] of graceTimers) {
    if (k.startsWith(`${code}:`)) {
      clearTimeout(t);
      graceTimers.delete(k);
    }
  }
  for (const k of userSockets.keys()) {
    if (k.startsWith(`${code}:`)) userSockets.delete(k);
  }

  // Collect answers:* keys with SCAN (KEYS would block Redis on big databases)
  const answerKeys = [];
  for await (const batch of redis.scanStream({ match: keys.answersPattern(code), count: 100 })) {
    answerKeys.push(...batch);
  }
  await redis.del(keys.state(code), keys.leaderboard(code), keys.players(code), ...answerKeys);

  await Room.updateOne({ code, status: { $ne: 'finished' } }, { status: 'finished' }).catch(() => {});
  console.log(`🧹 Room ${code} cleaned up`);
}
