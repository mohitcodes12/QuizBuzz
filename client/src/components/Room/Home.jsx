import CreateRoom from './CreateRoom.jsx';
import JoinRoom from './JoinRoom.jsx';
import { useAuth } from '../../AuthContext.jsx';

export default function Home() {
  const { user } = useAuth();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Ready when you are, {user.username}.</h1>
      <p className="mt-2 max-w-xl text-lg text-muted">Everyone gets each question at the same moment, and the leaderboard moves as answers come in.</p>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <JoinRoom />
        <CreateRoom />
      </div>
    </main>
  );
}
