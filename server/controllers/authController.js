import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { HttpError } from '../middleware/httpError.js';

// 10-12 rounds is the usual range. Each +1 doubles the hashing time, which
// makes brute-forcing stolen hashes slower. 12 is a good balance in 2020s.
const BCRYPT_ROUNDS = 12;

// A real-looking hash used when the email doesn't exist, so login takes the
// same time whether or not the account exists (prevents user enumeration).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

function publicUser(user) {
  return { id: user._id.toString(), username: user.username, email: user.email };
}

export async function register(req, res) {
  const { username, email, password } = req.body || {};
  const errors = [];

  if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 20) {
    errors.push('Username must be 3-20 characters');
  } else if (!USERNAME_RE.test(username.trim())) {
    errors.push('Username can only contain letters, numbers and underscores');
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    errors.push('A valid email is required');
  }
  if (typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  } else if (password.length > 72) {
    // bcrypt silently ignores anything after 72 bytes, so we refuse instead
    errors.push('Password must be at most 72 characters');
  }
  if (errors.length) throw new HttpError(400, errors[0], errors);

  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({
    username: username.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new HttpError(400, 'Email and password are required');
  }

  // passwordHash is select:false in the schema, so we must ask for it here
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  // Same message for "no such user" and "wrong password" on purpose
  if (!user || !ok) throw new HttpError(401, 'Invalid email or password');

  res.json({ token: signToken(user), user: publicUser(user) });
}

export async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json({ user: publicUser(user) });
}
