import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';

// Room codes are 6 characters, uppercase letters/digits
const clean = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export default function JoinRoom() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (code.length !== 6) return setError('Room codes have 6 characters');
    setError('');
    setBusy(true);
    try {
      // Check the code BEFORE navigating, so a typo shows an error right here
      const { room } = await api(`/rooms/${code}`);
      if (room.status === 'finished') throw new Error('That game has already finished');
      if (room.status === 'active') throw new Error('That game has already started');
      navigate(`/room/${code}`);
    } catch (err) {
      setError(err.status === 404 ? 'No room with that code. Check it and try again.' : err.message);
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="join-title">
      <h2 id="join-title" className="text-2xl font-extrabold">Join a game</h2>
      <p className="mt-1 text-muted">Ask the host for the 6-character room code.</p>
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="room-code" className="sr-only">Room code</label>
        <input
          id="room-code"
          value={code}
          onChange={(e) => setCode(clean(e.target.value))}
          placeholder="ABC123"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          className="field text-center font-display text-2xl font-extrabold tracking-[0.35em] sm:flex-1"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
          {busy ? 'Checking…' : 'Join game'}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
