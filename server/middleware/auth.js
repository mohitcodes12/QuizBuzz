import jwt from 'jsonwebtoken';
import { HttpError } from './httpError.js';

// Protects a route. Expects:  Authorization: Bearer <token>
// On success, sets req.user = { id, username } for the controller to use.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Authentication required'));
  }

  try {
    // jwt.verify checks the signature AND the expiry date
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

export function signToken(user) {
  return jwt.sign({ id: user._id.toString(), username: user.username }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}
