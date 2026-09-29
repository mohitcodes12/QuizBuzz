import { HttpError } from './httpError.js';

export function notFound(req, res, next) {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// One place that turns ANY error into a clean JSON response.
// Clients always get { error: "message" } (plus optional details).
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  let details = err.details;

  if (err.name === 'ValidationError') {
    // Mongoose schema validation failed
    status = 400;
    details = Object.values(err.errors).map((e) => e.message);
    message = details[0];
  } else if (err.code === 11000) {
    // MongoDB duplicate key (e.g. email already registered)
    status = 409;
    message = 'That value is already in use';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON body';
  }

  if (status >= 500) {
    console.error('❌ Unhandled error:', err);
    // Never leak internals to the client in production
    if (process.env.NODE_ENV === 'production') message = 'Something went wrong';
  }

  res.status(status).json({ error: message, ...(details ? { details } : {}) });
}
