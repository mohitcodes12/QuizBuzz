import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { registerGameHandlers } from './gameHandlers.js';

// Attaches Socket.io to the SAME http server Express uses (one port).
export function initSocket(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  // Runs ONCE per connection, before the 'connection' event.
  // The client sends its JWT in the handshake:  io(url, { auth: { token } })
  // If verification fails, the connection is refused and never reaches our handlers.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('AUTH_REQUIRED'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      // We trust ONLY this (signed) identity, never a userId sent in an event
      socket.data.user = { id: payload.id, username: payload.username };
      next();
    } catch {
      next(new Error('AUTH_INVALID'));
    }
  });

  io.on('connection', (socket) => registerGameHandlers(io, socket));

  return io;
}
