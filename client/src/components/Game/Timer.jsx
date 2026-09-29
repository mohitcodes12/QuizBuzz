import { useEffect, useState } from 'react';

// DISPLAY ONLY. The real timer runs on the server; this just draws it.
// `endsAt` is the server's deadline. `clockOffset` (serverNow - clientNow,
// measured when the question arrived) fixes clients whose clock is wrong,
// so a phone that is 10s fast still shows the same countdown as everybody else.
export default function Timer({ endsAt, clockOffset, totalMs, running }) {
  const [left, setLeft] = useState(() => Math.max(0, endsAt - (Date.now() + clockOffset)));

  useEffect(() => {
    let raf;
    const tick = () => {
      const remaining = Math.max(0, endsAt - (Date.now() + clockOffset));
      setLeft(remaining);
      if (running && remaining > 0) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [endsAt, clockOffset, running]);

  const pct = Math.min(100, (left / totalMs) * 100);
  const urgent = left <= 5000;

  return (
    <div className="flex items-center gap-4" role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-sunk">
        <div className={`h-full rounded-full ${urgent ? 'bg-coral' : 'bg-buzzer'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-12 text-right font-display text-3xl font-extrabold tabular-nums ${urgent ? 'text-coral' : ''}`}>
        {Math.ceil(left / 1000)}
      </span>
    </div>
  );
}
