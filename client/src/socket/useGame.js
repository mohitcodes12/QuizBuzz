import { useCallback, useEffect, useRef, useState } from 'react';
import { createSocket } from './socket.js';

// Errors after which retrying is pointless: we show a full-screen message
const FATAL_CODES = ['BAD_CODE', 'ROOM_NOT_FOUND', 'ROOM_FINISHED', 'ROOM_STARTED', 'ROOM_UNAVAILABLE', 'REPLACED'];

const initialState = {
  connected: false,
  phase: 'connecting', // connecting | lobby | starting | question | reveal | finished
  hostId: null,
  players: [],
  leaderboard: [],
  question: null, // { index, total, text, options, endsAt, timeLimitSec }
  selected: null, // option index this player picked
  answered: false,
  reveal: null, // payload of game:questionEnd
  final: null, // payload of game:finished
  history: [], // score snapshot after every question (for the Recharts line chart)
  clockOffset: 0, // serverNow - clientNow, so the countdown matches the SERVER clock
  notices: [],
  fatalError: null,
};

// All socket <-> React glue lives here, so components stay simple:
// they just read `state` and call start() / answer() / leave().
export function useGame(code) {
  const [state, setState] = useState(initialState);
  const socketRef = useRef(null);
  const noticeId = useRef(0);
  // Always holds the latest state, so callbacks can read it without side
  // effects inside a setState updater (React may run updaters twice in dev).
  const stateRef = useRef(state);
  stateRef.current = state;

  const pushNotice = useCallback((type, text) => {
    const id = ++noticeId.current;
    setState((s) => ({ ...s, notices: [...s.notices, { id, type, text }] }));
    setTimeout(() => setState((s) => ({ ...s, notices: s.notices.filter((n) => n.id !== id) })), 4500);
  }, []);

  useEffect(() => {
    setState(initialState);
    const socket = createSocket();
    socketRef.current = socket;

    // 'connect' fires on the first connection AND after every automatic
    // reconnection. Joining again here is what makes rejoin work: the server
    // recognises our JWT, restores our score and re-sends the current question.
    socket.on('connect', () => {
      setState((s) => ({ ...s, connected: true }));
      socket.emit('room:join', { code });
    });
    socket.on('disconnect', () => setState((s) => ({ ...s, connected: false })));
    socket.on('connect_error', (err) => {
      if (err.message === 'AUTH_REQUIRED' || err.message === 'AUTH_INVALID') {
        setState((s) => ({ ...s, fatalError: 'Your session expired. Please log in again.' }));
        socket.disconnect();
      }
    });

    socket.on('room:playerList', ({ status, hostId, players }) => {
      setState((s) => {
        let phase = s.phase;
        if (status === 'lobby') phase = 'lobby';
        else if (status === 'active' && (phase === 'connecting' || phase === 'lobby')) phase = 'starting';
        return { ...s, hostId, players, phase };
      });
    });

    socket.on('game:question', (q) => {
      setState((s) => ({
        ...s,
        phase: 'question',
        question: q,
        reveal: null,
        // `answered` is only present when we rejoin after answering
        answered: Boolean(q.answered),
        selected: q.answered && s.question?.index === q.index ? s.selected : null,
        clockOffset: q.serverNow - Date.now(),
      }));
    });

    socket.on('game:answerAck', () => setState((s) => ({ ...s, answered: true })));

    socket.on('game:questionEnd', (end) => {
      setState((s) => {
        const snapshot = { question: end.index + 1 };
        end.leaderboard.forEach((e) => (snapshot[e.userId] = e.score));
        const history = [...s.history.filter((h) => h.question !== snapshot.question), snapshot].sort(
          (a, b) => a.question - b.question
        );
        return { ...s, phase: 'reveal', reveal: end, leaderboard: end.leaderboard, history };
      });
    });

    socket.on('leaderboard:update', ({ leaderboard }) => setState((s) => ({ ...s, leaderboard })));

    socket.on('game:finished', (final) => {
      setState((s) => ({ ...s, phase: 'finished', final, leaderboard: final.finalLeaderboard }));
    });

    socket.on('player:disconnected', ({ username, graceMs }) => {
      const secs = Math.round(graceMs / 1000);
      pushNotice('warn', secs ? `${username} lost connection (${secs}s to rejoin)` : `${username} left`);
    });
    socket.on('player:reconnected', ({ username }) => pushNotice('ok', `${username} is back`));

    socket.on('error', ({ code: errCode, message }) => {
      if (FATAL_CODES.includes(errCode)) {
        setState((s) => ({ ...s, fatalError: message }));
        socket.disconnect(); // stop auto-reconnecting into a room we can't enter
      } else {
        pushNotice('error', message);
      }
    });

    socket.connect();

    return () => {
      // Leaving the screen = leaving the room on purpose (no grace period)
      socket.emit('room:leave');
      socket.disconnect();
    };
  }, [code, pushNotice]);

  const start = useCallback(() => socketRef.current?.emit('game:start'), []);

  const answer = useCallback((optionIndex) => {
    const s = stateRef.current;
    if (s.phase !== 'question' || s.answered || !s.question) return;
    // We only send WHICH option and WHICH question. Never a time or a score:
    // the server measures time itself and calculates the points.
    socketRef.current?.emit('game:answer', { questionIndex: s.question.index, optionIndex });
    setState((prev) => ({ ...prev, selected: optionIndex, answered: true }));
  }, []);

  return { ...state, start, answer };
}
