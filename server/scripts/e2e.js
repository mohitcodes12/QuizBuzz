// End-to-end test: plays a whole game with 3 real socket clients.
//
//   1. start the server (ideally with short timings for a fast test):
//        DISCONNECT_GRACE_MS=3000 RESULT_PAUSE_MS=1200 npm start
//   2. in another terminal:  npm run test:e2e
//
// Needs MongoDB + Redis running. It creates throw-away users and a quiz.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import Redis from 'ioredis';

const API = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = Date.now().toString(36);

let passed = 0;
function ok(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}

async function api(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function makeUser(name) {
  const r = await api('POST', '/api/auth/register', {
    username: `${name}_${stamp}`.slice(0, 20),
    email: `${name}.${stamp}@test.dev`,
    password: 'password123',
  });
  assert.equal(r.status, 201, `register ${name}: ${JSON.stringify(r.data)}`);
  return { ...r.data.user, token: r.data.token };
}

// Connects a socket and keeps a log of every event it receives
function connect(token) {
  const socket = io(API, { auth: { token }, transports: ['websocket'], forceNew: true });
  socket.log = [];
  socket.onAny((event, payload) => socket.log.push({ event, payload }));
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

// Resolves with the next matching event received from now on
function next(socket, event, pred = () => true, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeout);
    function handler(payload) {
      if (!pred(payload)) return;
      clearTimeout(t);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

const errorAfter = (socket, action) => {
  const p = next(socket, 'error', () => true, 3000);
  action();
  return p;
};

async function main() {
  console.log('\n— REST API —');
  const host = await makeUser('host');
  const alice = await makeUser('alice');
  const bob = await makeUser('bob');
  const late = await makeUser('late');
  ok('registered 4 users');

  let r = await api('POST', '/api/auth/register', { username: 'x', email: 'bad', password: '1' });
  assert.equal(r.status, 400);
  ok('register validation rejects bad input');

  r = await api('POST', '/api/auth/register', { username: 'dupe', email: `host.${stamp}@test.dev`, password: 'password123' });
  assert.equal(r.status, 409);
  ok('duplicate email rejected');

  r = await api('POST', '/api/auth/login', { email: `host.${stamp}@test.dev`, password: 'wrongpass' });
  assert.equal(r.status, 401);
  r = await api('POST', '/api/auth/login', { email: `host.${stamp}@test.dev`, password: 'password123' });
  assert.equal(r.status, 200);
  assert.ok(r.data.token);
  ok('login: wrong password 401, right password returns JWT');

  r = await api('GET', '/api/auth/me', null, host.token);
  assert.equal(r.data.user.username, host.username);
  assert.equal(r.data.user.passwordHash, undefined);
  ok('/me works and never returns the hash');

  r = await api('GET', '/api/quiz');
  assert.equal(r.status, 401);
  ok('quiz routes require a JWT');

  const quizBody = {
    title: 'E2E quiz',
    questions: [
      { text: 'Q1?', options: ['a', 'b', 'c', 'd'], correctIndex: 1, timeLimitSec: 5 },
      { text: 'Q2?', options: ['a', 'b', 'c', 'd'], correctIndex: 2, timeLimitSec: 5 },
    ],
  };
  r = await api('POST', '/api/quiz', { title: 'bad', questions: [{ text: 'x', options: ['a'], correctIndex: 9 }] }, host.token);
  assert.equal(r.status, 400);
  r = await api('POST', '/api/quiz', quizBody, host.token);
  assert.equal(r.status, 201);
  const quizId = r.data.quiz._id;
  r = await api('GET', `/api/quiz/${quizId}`, null, alice.token);
  assert.equal(r.status, 404);
  r = await api('PUT', `/api/quiz/${quizId}`, { ...quizBody, title: 'E2E quiz v2' }, host.token);
  assert.equal(r.data.quiz.title, 'E2E quiz v2');
  r = await api('GET', '/api/quiz', null, host.token);
  assert.equal(r.data.quizzes.length, 1);
  ok('quiz CRUD + ownership checks');

  r = await api('POST', '/api/rooms', { quizId }, host.token);
  assert.equal(r.status, 201);
  const code = r.data.code;
  assert.match(code, /^[A-Z2-9]{6}$/);
  r = await api('GET', `/api/rooms/${code}`, null, alice.token);
  assert.equal(r.data.room.quiz.questionCount, 2);
  assert.equal(JSON.stringify(r.data).includes('correctIndex'), false);
  ok(`room created (${code}); GET /rooms/:code leaks no answers`);

  console.log('\n— Sockets: auth & lobby —');
  await assert.rejects(connect('not-a-token'));
  ok('socket with a bad JWT is refused');

  const sH = await connect(host.token);
  const sA = await connect(alice.token);
  let sB = await connect(bob.token);
  const listSeen = next(sH, 'room:playerList', (p) => p.players.length === 3);
  sH.emit('room:join', { code });
  await sleep(100);
  sA.emit('room:join', { code });
  await sleep(100);
  sB.emit('room:join', { code });
  const list = await listSeen;
  assert.equal(list.hostId, host.id);
  assert.equal(list.status, 'lobby');
  ok('3 players joined the lobby, host identified');

  let e = await errorAfter(sA, () => sA.emit('game:start'));
  assert.equal(e.code, 'NOT_HOST');
  ok('non-host cannot start the game');

  console.log('\n— Question 1 —');
  const q0 = { H: next(sH, 'game:question'), A: next(sA, 'game:question'), B: next(sB, 'game:question') };
  sH.emit('game:start');
  const [qH, qA] = [await q0.H, await q0.A];
  await q0.B;
  assert.equal(qH.index, 0);
  assert.equal(qH.endsAt, qA.endsAt);
  assert.equal(JSON.stringify(qH).includes('correctIndex'), false);
  assert.equal(qH.options.length, 4);
  ok('all players got the SAME question + deadline, with no correctIndex');

  const end0 = next(sH, 'game:questionEnd');
  sA.emit('game:answer', { questionIndex: 0, optionIndex: 1 }); // correct, instantly
  e = await errorAfter(sA, () => sA.emit('game:answer', { questionIndex: 0, optionIndex: 1 }));
  assert.equal(e.code, 'ALREADY_ANSWERED');
  ok('double answer rejected (Redis SADD guard)');
  await sleep(600);
  sB.emit('game:answer', { questionIndex: 0, optionIndex: 1 }); // correct, slower
  await sleep(200);
  sH.emit('game:answer', { questionIndex: 0, optionIndex: 3 }); // wrong
  const e0 = await end0; // everyone answered -> ends early, before the 5s timer
  assert.equal(e0.correctIndex, 1);
  const scoreOf = (lb, u) => lb.find((x) => x.userId === u.id).score;
  const a0 = scoreOf(e0.leaderboard, alice);
  const b0 = scoreOf(e0.leaderboard, bob);
  assert.ok(a0 >= 1490 && a0 <= 1500, `alice ${a0}`);
  assert.ok(b0 < a0 && b0 > 1300, `bob ${b0}`);
  assert.equal(scoreOf(e0.leaderboard, host), 0);
  assert.equal(e0.leaderboard[0].userId, alice.id);
  ok(`scoring: alice ${a0} > bob ${b0} > host 0 (speed bonus works, ranked by Redis)`);

  console.log('\n— Late join blocked —');
  const sL = await connect(late.token);
  e = await errorAfter(sL, () => sL.emit('room:join', { code }));
  assert.equal(e.code, 'ROOM_STARTED');
  sL.close();
  ok('new player cannot join a game in progress');

  console.log('\n— Question 2: disconnect + rejoin —');
  await next(sH, 'game:question', (q) => q.index === 1);
  const dcSeen = next(sA, 'player:disconnected');
  sB.close(); // simulate lost connection
  const dc = await dcSeen;
  assert.equal(dc.userId, bob.id);
  ok('others are told when a player disconnects');

  await sleep(500);
  sB = await connect(bob.token); // same JWT, new socket
  const backSeen = next(sA, 'player:reconnected');
  const qBack = next(sB, 'game:question');
  const lbBack = next(sB, 'leaderboard:update');
  sB.emit('room:join', { code });
  const [back, qb, lb] = await Promise.all([backSeen, qBack, lbBack]);
  assert.equal(back.userId, bob.id);
  assert.equal(qb.index, 1);
  assert.equal(qb.answered, false);
  assert.equal(JSON.stringify(qb).includes('correctIndex'), false);
  assert.equal(scoreOf(lb.leaderboard, bob), b0);
  ok('rejoin within grace period: same question restored, score kept, others notified');

  const end1 = next(sH, 'game:questionEnd', (x) => x.index === 1, 12000);
  sA.emit('game:answer', { questionIndex: 1, optionIndex: 2 });
  sB.emit('game:answer', { questionIndex: 1, optionIndex: 2 });
  // host does NOT answer -> the server timer must end the question
  const t0 = Date.now();
  const e1 = await end1;
  const waited = Date.now() - t0;
  assert.ok(waited > 3000, `ended too early (${waited}ms): timer should have run`);
  assert.equal(e1.correctIndex, 2);
  assert.equal(e1.isLast, true);
  ok(`server timer ended the question after ~${(waited / 1000).toFixed(1)}s (host never answered)`);

  e = await errorAfter(sH, () => sH.emit('game:answer', { questionIndex: 1, optionIndex: 2 }));
  assert.ok(['ANSWER_CLOSED', 'TOO_LATE'].includes(e.code));
  ok(`late answer rejected (${e.code})`);

  const fin = await next(sH, 'game:finished');
  assert.equal(fin.winner.userId, alice.id);
  assert.equal(fin.finalLeaderboard.length, 3);
  ok(`game finished, winner: ${fin.winner.username} with ${fin.winner.score}`);

  await sleep(300);
  r = await api('GET', `/api/rooms/${code}`, null, host.token);
  assert.equal(r.data.room.status, 'finished');
  ok('Mongo room status = finished');
  [sH, sA, sB].forEach((s) => s.close());

  console.log('\n— Lobby: host disconnect reassigns host; empty room cleans up —');
  r = await api('POST', '/api/rooms', { quizId }, host.token);
  const code2 = r.data.code;
  const h2 = await connect(host.token);
  const p2 = await connect(alice.token);
  h2.emit('room:join', { code: code2 });
  await sleep(100);
  p2.emit('room:join', { code: code2 });
  await next(p2, 'room:playerList', (l) => l.players.length === 2);
  const reassigned = next(p2, 'room:playerList', (l) => l.hostId === alice.id && l.players.length === 1, 8000);
  h2.close();
  await reassigned;
  ok('after the grace period the host role moved to the next player');

  p2.emit('room:leave');
  await sleep(400);
  const redis = new Redis(process.env.REDIS_URL);
  const left = await redis.keys(`room:${code2}:*`);
  await redis.quit();
  assert.deepEqual(left, []);
  ok('empty room: all Redis keys deleted');
  p2.close();

  console.log(`\n🎉 All ${passed} checks passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ E2E FAILED:', err.message);
  process.exit(1);
});
