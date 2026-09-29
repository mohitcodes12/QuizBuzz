import { useState } from 'react';

// The room code is the most important thing on this screen, so it gets
// big physical "tiles" that can be read across a room or from a projector.
export default function Lobby({ code, players, hostId, meId, connected, onStart, onLeave }) {
  const [copied, setCopied] = useState('');
  const isHost = hostId === meId;
  const link = `${window.location.origin}/room/${code}`;

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      window.prompt('Copy this:', text);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-extrabold sm:text-4xl">Waiting for players</h1>
      <p className="mt-1 text-muted">Share this code. Players join at <span className="font-semibold text-paper">{window.location.host}</span>.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3" aria-label={`Room code ${code.split('').join(' ')}`}>
        {code.split('').map((ch, i) => (
          <span key={i} aria-hidden className="grid h-16 w-12 place-items-center rounded-lg bg-buzzer font-display text-4xl font-extrabold text-ink sm:h-24 sm:w-[4.5rem] sm:text-6xl" style={{ boxShadow: '0 6px 0 #b98f00' }}>
            {ch}
          </span>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="btn btn-ghost" onClick={() => copy(code, 'code')}>{copied === 'code' ? 'Code copied' : 'Copy code'}</button>
        <button className="btn btn-ghost" onClick={() => copy(link, 'link')}>{copied === 'link' ? 'Link copied' : 'Copy invite link'}</button>
      </div>

      <section className="panel mt-8" aria-label="Players in the room">
        <h2 className="mb-3 text-xl font-extrabold">{players.length} in the room</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <li key={p.userId} className={`flex items-center gap-2 rounded-lg bg-sunk/60 px-3 py-2 ${p.connected ? '' : 'opacity-60'}`}>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.connected ? 'bg-mint' : 'bg-muted'}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {p.username}{p.userId === meId && ' (you)'}
              </span>
              {p.isHost && <span className="rounded bg-buzzer px-2 py-0.5 text-xs font-bold text-ink">Host</span>}
              {!p.connected && <span className="text-xs">reconnecting</span>}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        {isHost ? (
          <button className="btn btn-primary text-lg" onClick={onStart} disabled={!connected || players.length < 1}>
            Start game
          </button>
        ) : (
          <p className="font-semibold" role="status">The host will start the game. Hang tight.</p>
        )}
        <button className="btn btn-ghost" onClick={onLeave}>Leave room</button>
      </div>
    </main>
  );
}
