import mongoose from 'mongoose';
import crypto from 'crypto';

// Room codes use 32 characters and skip look-alikes (0/O, 1/I) so people can
// read a code aloud or type it from a screen without mistakes.
// 32^6 is about 1 billion combinations, plenty for collision-free codes.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const roomSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true, // the DB itself guarantees uniqueness, even under a race condition
    uppercase: true,
    length: CODE_LENGTH,
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
  status: {
    type: String,
    enum: ['lobby', 'active', 'finished'],
    default: 'lobby',
  },
  // A record of who took part. Live state (scores, who is connected) lives in
  // Redis during the game; this is the permanent history. The final score is
  // written here when the game finishes.
  players: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      username: String,
      score: { type: Number, default: 0 },
      joinedAt: { type: Date, default: Date.now },
      _id: false,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Generates a random code and checks it isn't taken.
// crypto.randomInt is cryptographically secure (Math.random is guessable),
// so people can't predict other rooms' codes.
roomSchema.statics.generateUniqueCode = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    }
    const exists = await this.exists({ code });
    if (!exists) return code;
  }
  throw new Error('Could not generate a unique room code, please try again');
};

export default mongoose.model('Room', roomSchema);
