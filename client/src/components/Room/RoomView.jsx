import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../AuthContext.jsx';
import { useGame } from '../../socket/useGame.js';
import Lobby from './Lobby.jsx';
import GameScreen from '../Game/GameScreen.jsx';
import Results from '../Game/Results.jsx';

// One screen for the whole life of a room. It picks what to draw
// from `game.phase`, which the server drives through socket events.
export default function RoomView() {
  const { code: rawCode } = useParams();
  const code = rawCode.toUpperCase();
  const { user } = useAuth();
  const navigate = useNavigate();
  const game = useGame(code);

  const goHome = () => navigate('/');

  if (game.fatalError) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-extrabold">Can't open this room</h1>
        <p role="alert" className="mt-3 text-muted">{game.fatalError}</p>
        <button className="btn btn-primary mt-6" onClick={goHome}>Back to home</button>
      </main>
    );
  }

  let screen;
  if (game.phase === 'connecting') {
    screen = (
      <main className="grid min-h-[60vh] place-items-center px-4">
        <p role="status" className="text-lg text-muted">Connecting to room {code}…</p>
      </main>
    );
  } else if (game.phase === 'lobby') {
    screen = (
      <Lobby code={code} players={game.players} hostId={game.hostId} meId={user.id} connected={game.connected} onStart={game.start} onLeave={goHome} />
    );
  } else if (game.phase === 'finished') {
    screen = <Results final={game.final} history={game.history} meId={user.id} onExit={goHome} />;
  } else {
    screen = <GameScreen game={game} meId={user.id} />;
  }

  return (
    <>
      {!game.connected && game.phase !== 'connecting' && (
        <div role="alert" className="bg-coral px-4 py-2 text-center font-semibold text-ink">
          Connection lost. Reconnecting… your score is safe.
        </div>
      )}
      {screen}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex flex-col items-center gap-2 px-4">
        {game.notices.map((n) => (
          <p key={n.id} className={`rounded-lg px-4 py-2 text-sm font-semibold ${n.type === 'error' ? 'bg-danger text-ink' : n.type === 'ok' ? 'bg-mint text-ink' : 'bg-paper text-ink'}`}>
            {n.text}
          </p>
        ))}
      </div>
    </>
  );
}
