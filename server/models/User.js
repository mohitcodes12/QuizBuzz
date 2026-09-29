import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [20, 'Username must be at most 20 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true, // creates a unique index in MongoDB
    lowercase: true, // "A@b.com" and "a@b.com" are the same user
    trim: true,
  },
  // We store ONLY the bcrypt hash, never the real password.
  // select: false means queries won't return it unless we explicitly ask
  // (login uses .select('+passwordHash')). This prevents accidental leaks.
  passwordHash: {
    type: String,
    required: true,
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('User', userSchema);
