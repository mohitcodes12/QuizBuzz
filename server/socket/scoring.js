// Pure function (no I/O) so it is trivial to unit-test.
//
//   wrong / no answer  -> 0
//   correct            -> 1000 base + up to 500 speed bonus
//
// The bonus scales linearly with how much time was LEFT when the answer
// reached the server:  answered instantly -> +500,  at the buzzer -> +0.
// remainingMs comes from the SERVER clock (endsAt - Date.now()), never from
// anything the client sends, so players can't fake a fast answer.
export const BASE_POINTS = 1000;
export const MAX_SPEED_BONUS = 500;

export function calculateScore({ isCorrect, remainingMs, totalMs }) {
  if (!isCorrect) return 0;
  const ratio = Math.min(1, Math.max(0, remainingMs / totalMs));
  return BASE_POINTS + Math.round(MAX_SPEED_BONUS * ratio);
}
