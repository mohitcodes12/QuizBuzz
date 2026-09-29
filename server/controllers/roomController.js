import mongoose from 'mongoose';
import Room from '../models/Room.js';
import Quiz from '../models/Quiz.js';
import { redis, keys, ROOM_TTL_SECONDS } from '../config/redis.js';
import { HttpError } from '../middleware/httpError.js';

// POST /api/rooms  { quizId }  ->  { code }
export async function createRoom(req, res) {
  const { quizId } = req.body || {};
  if (!mongoose.isValidObjectId(quizId)) throw new HttpError(400, 'A valid quizId is required');

  const quiz = await Quiz.findById(quizId);
  if (!quiz || quiz.createdBy.toString() !== req.user.id) throw new HttpError(404, 'Quiz not found');

  // The unique index on `code` is the real guarantee. generateUniqueCode just
  // makes a collision unlikely; if two requests still collide, Mongo throws
  // E11000 and we retry once with a fresh code.
  let room;
  for (let attempt = 0; attempt < 2 && !room; attempt++) {
    const code = await Room.generateUniqueCode();
    try {
      room = await Room.create({ code, host: req.user.id, quiz: quiz._id });
    } catch (err) {
      if (err.code !== 11000 || attempt === 1) throw err;
    }
  }

  // Create the live game state in Redis. Everything real-time reads this.
  const stateKey = keys.state(room.code);
  await redis
    .multi()
    .hset(stateKey, {
      status: 'lobby',
      currentQuestionIndex: -1,
      questionEndsAt: 0,
      hostId: req.user.id,
    })
    .expire(stateKey, ROOM_TTL_SECONDS)
    .exec();

  res.status(201).json({ code: room.code, room: { code: room.code, status: room.status } });
}

// GET /api/rooms/:code -> public info so the Join screen can check a code.
// Never includes questions or answers.
export async function getRoom(req, res) {
  const code = String(req.params.code || '').toUpperCase();
  const room = await Room.findOne({ code })
    .populate('host', 'username')
    .populate('quiz', 'title questions');
  if (!room) throw new HttpError(404, 'Room not found');

  // Redis holds the live status; fall back to Mongo if the keys expired
  const liveStatus = await redis.hget(keys.state(code), 'status');
  const playerCount = await redis.hlen(keys.players(code));

  res.json({
    room: {
      code: room.code,
      status: liveStatus || room.status,
      host: room.host ? { id: room.host._id, username: room.host.username } : null,
      quiz: room.quiz ? { title: room.quiz.title, questionCount: room.quiz.questions.length } : null,
      playerCount,
      createdAt: room.createdAt,
    },
  });
}
