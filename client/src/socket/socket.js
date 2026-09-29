import { io } from 'socket.io-client';
import { API_URL, tokenStore } from '../api.js';

// Creates ONE socket per room screen. It does not connect until we call
// socket.connect(), so the caller can attach listeners first.
//
// `auth` is a function, so every (re)connection sends the CURRENT token.
// The server reads it in its handshake middleware and rejects bad tokens.
export function createSocket() {
  return io(API_URL, {
    autoConnect: false,
    auth: (cb) => cb({ token: tokenStore.get() }),
    reconnectionDelayMax: 3000, // keep retrying quickly after a network drop
  });
}
