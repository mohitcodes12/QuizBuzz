// Run with:  npm run test:scoring   (no database needed)
import assert from 'node:assert/strict';
import { calculateScore } from '../socket/scoring.js';

const total = 20_000;
assert.equal(calculateScore({ isCorrect: false, remainingMs: 20_000, totalMs: total }), 0, 'wrong = 0');
assert.equal(calculateScore({ isCorrect: true, remainingMs: 20_000, totalMs: total }), 1500, 'instant = 1500');
assert.equal(calculateScore({ isCorrect: true, remainingMs: 10_000, totalMs: total }), 1250, 'half time = 1250');
assert.equal(calculateScore({ isCorrect: true, remainingMs: 0, totalMs: total }), 1000, 'buzzer = 1000');
assert.equal(calculateScore({ isCorrect: true, remainingMs: 30_000, totalMs: total }), 1500, 'clamped high');
assert.equal(calculateScore({ isCorrect: true, remainingMs: -50, totalMs: total }), 1000, 'clamped low');
console.log('✅ scoring tests passed');
