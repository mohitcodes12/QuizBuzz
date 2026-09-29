import mongoose from 'mongoose';

// A question is an embedded sub-document (not its own collection) because
// questions never exist without their quiz, and we always load them together.
const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    options: {
      type: [String],
      validate: {
        validator: (arr) => arr.length === 4 && arr.every((o) => o && o.trim()),
        message: 'Each question needs exactly 4 non-empty options',
      },
    },
    // Index (0-3) of the right option. The SERVER keeps this secret:
    // it is only sent to clients in game:questionEnd, never in game:question.
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    timeLimitSec: {
      type: Number,
      default: 20,
      min: 5,
      max: 120,
    },
  },
  { _id: false } // we identify questions by array position (index), not by id
);

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Quiz title is required'],
    trim: true,
    maxlength: 100,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true, // GET /api/quiz (mine) filters by this, so index it
  },
  questions: {
    type: [questionSchema],
    validate: {
      validator: (arr) => arr.length >= 1,
      message: 'A quiz needs at least 1 question',
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Quiz', quizSchema);
