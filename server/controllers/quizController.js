import mongoose from 'mongoose';
import Quiz from '../models/Quiz.js';
import { HttpError } from '../middleware/httpError.js';

const MAX_QUESTIONS = 50;

// Validates and CLEANS the request body. We copy only the fields we expect,
// so a client can't sneak in extra fields (e.g. createdBy) - "whitelisting".
function parseQuizBody(body) {
  const { title, questions } = body || {};

  if (typeof title !== 'string' || !title.trim() || title.trim().length > 100) {
    throw new HttpError(400, 'Title is required (max 100 characters)');
  }
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > MAX_QUESTIONS) {
    throw new HttpError(400, `A quiz needs between 1 and ${MAX_QUESTIONS} questions`);
  }

  const cleaned = questions.map((q, i) => {
    const n = i + 1;
    if (!q || typeof q.text !== 'string' || !q.text.trim()) {
      throw new HttpError(400, `Question ${n}: text is required`);
    }
    if (
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      q.options.some((o) => typeof o !== 'string' || !o.trim())
    ) {
      throw new HttpError(400, `Question ${n}: exactly 4 non-empty options are required`);
    }
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
      throw new HttpError(400, `Question ${n}: correctIndex must be 0, 1, 2 or 3`);
    }
    let timeLimitSec = 20;
    if (q.timeLimitSec !== undefined) {
      if (!Number.isInteger(q.timeLimitSec) || q.timeLimitSec < 5 || q.timeLimitSec > 120) {
        throw new HttpError(400, `Question ${n}: timeLimitSec must be a whole number 5-120`);
      }
      timeLimitSec = q.timeLimitSec;
    }
    return {
      text: q.text.trim(),
      options: q.options.map((o) => o.trim()),
      correctIndex: q.correctIndex,
      timeLimitSec,
    };
  });

  return { title: title.trim(), questions: cleaned };
}

function assertValidId(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid quiz id');
}

// Loads a quiz and makes sure the logged-in user owns it.
// We return 404 (not 403) for other people's quizzes so ids can't be probed.
async function findOwnedQuiz(id, userId) {
  assertValidId(id);
  const quiz = await Quiz.findById(id);
  if (!quiz || quiz.createdBy.toString() !== userId) throw new HttpError(404, 'Quiz not found');
  return quiz;
}

export async function createQuiz(req, res) {
  const data = parseQuizBody(req.body);
  const quiz = await Quiz.create({ ...data, createdBy: req.user.id });
  res.status(201).json({ quiz });
}

export async function listMyQuizzes(req, res) {
  const quizzes = await Quiz.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
  res.json({ quizzes });
}

export async function getQuiz(req, res) {
  const quiz = await findOwnedQuiz(req.params.id, req.user.id);
  res.json({ quiz });
}

export async function updateQuiz(req, res) {
  const quiz = await findOwnedQuiz(req.params.id, req.user.id);
  const data = parseQuizBody(req.body);
  quiz.title = data.title;
  quiz.questions = data.questions;
  await quiz.save();
  res.json({ quiz });
}

export async function deleteQuiz(req, res) {
  const quiz = await findOwnedQuiz(req.params.id, req.user.id);
  await quiz.deleteOne();
  res.json({ message: 'Quiz deleted' });
}
