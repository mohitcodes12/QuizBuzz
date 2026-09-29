import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Leaderboard from '../Leaderboard/Leaderboard.jsx';

const LINE_COLORS = ['#FFD23F', '#72CBFF', '#7DE3A8', '#FF8F87', '#C9AEFF'];
const AXIS = { fill: '#B9B5F0', fontSize: 12 };
const TOOLTIP = { background: '#16135A', border: '1px solid rgba(255,255,255,.2)', borderRadius: 8, color: '#F4F2FF' };

export default function Results({ final, history, meId, onExit }) {
  const board = final.finalLeaderboard;
  const winner = final.winner;
  const iWon = winner?.userId === meId;
  const topFive = board.slice(0, 5);

  const barData = board.map((e) => ({ name: e.username, score: e.score, userId: e.userId }));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      <h1 className="text-4xl font-extrabold sm:text-6xl">
        {!winner ? 'Game over' : iWon ? 'You won!' : `${winner.username} wins!`}
      </h1>
      {winner && <p className="mt-2 text-xl text-muted">{winner.score.toLocaleString()} points</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Leaderboard entries={board} meId={meId} limit={20} title="Final standings" />

        <section className="panel" aria-label="Final scores chart">
          <h2 className="mb-3 text-xl font-extrabold">Final scores</h2>
          <div style={{ height: Math.max(200, barData.length * 44) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <CartesianGrid stroke="rgba(255,255,255,.1)" horizontal={false} />
                <XAxis type="number" tick={AXIS} stroke="rgba(255,255,255,.2)" />
                <YAxis type="category" dataKey="name" width={84} tick={AXIS} stroke="rgba(255,255,255,.2)" />
                <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(255,255,255,.06)' }} />
                <Bar dataKey="score" name="Score" radius={[0, 6, 6, 0]}>
                  {barData.map((d) => (
                    <Cell key={d.userId} fill={d.userId === meId ? '#FFD23F' : '#72CBFF'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {history.length >= 2 && (
        <section className="panel mt-6" aria-label="Score progression chart">
          <h2 className="mb-1 text-xl font-extrabold">How the game unfolded</h2>
          <p className="mb-3 text-sm text-muted">Total score after each question, top 5 players.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ left: 0, right: 16, top: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,.1)" />
                <XAxis dataKey="question" tick={AXIS} stroke="rgba(255,255,255,.2)" label={{ value: 'Question', position: 'insideBottom', offset: -2, fill: '#B9B5F0', fontSize: 12 }} />
                <YAxis tick={AXIS} stroke="rgba(255,255,255,.2)" width={48} />
                <Tooltip contentStyle={TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#B9B5F0' }} />
                {topFive.map((p, i) => (
                  <Line key={p.userId} type="monotone" dataKey={p.userId} name={p.username} stroke={LINE_COLORS[i]} strokeWidth={3} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <button className="btn btn-primary mt-8" onClick={onExit}>Back to home</button>
    </main>
  );
}
