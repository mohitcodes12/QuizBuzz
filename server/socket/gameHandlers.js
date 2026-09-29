import {
  GameError,
  joinRoom,
  leaveRoom,
  startGame,
  handleAnswer,
  handleDisconnect,
} from './gameEngine.js';

// Wires socket events (the contract) to engine functions.
// This file is deliberately thin: all the logic lives in gameEngine.js.
export function registerGameHandlers(io, socket) {
  // Wrap every handler so an error becomes an 'error' event to THIS client
  // instead of an unhandled rejection that could crash the server.
  const safe =
    (fn) =>
    async (...args) => {
      try {
        await fn(...args);
      } catch (err) {
        if (err instanceof GameError) {
          socket.emit('error', { code: err.code, message: err.message });
        } else {
          console.error('❌ Socket handler error:', err);
          socket.emit('error', { code: 'INTERNAL', message: 'Something went wrong' });
        }
      }
    };

  socket.on('room:join', safe((payload) => joinRoom(io, socket, payload?.code)));
  socket.on('room:leave', safe(() => leaveRoom(io, socket)));
  socket.on('game:start', safe(() => startGame(io, socket)));
  socket.on('game:answer', safe((payload) => handleAnswer(io, socket, payload)));

  socket.on('disconnect', () => {
    handleDisconnect(io, socket).catch((err) => console.error('❌ Disconnect error:', err));
  });
}
