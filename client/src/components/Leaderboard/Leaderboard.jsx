// Live scores. `entries` is already sorted by the server (Redis ZREVRANGE),
// so this component only displays: no sorting logic on the client.
export default function Leaderboard({ entries, meId, limit = 10, title = 'Leaderboard' }) {
  const top = entries.slice(0, limit);
  const me = entries.find((e) => e.userId === meId);
  // If I'm outside the top N, still show me at the bottom so I know where I stand
  const showMeSeparately = me && me.rank > limit;

  return (
    <section aria-label={title} className="panel">
      <h2 className="mb-3 text-xl font-extrabold">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-muted">Scores appear here as players answer.</p>
      ) : (
        <ol className="space-y-1.5">
          {top.map((e) => (
            <Row key={e.userId} entry={e} isMe={e.userId === meId} />
          ))}
          {showMeSeparately && (
            <>
              <li aria-hidden className="text-center text-muted">…</li>
              <Row entry={me} isMe />
            </>
          )}
        </ol>
      )}
    </section>
  );
}

function Row({ entry, isMe }) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
        isMe ? 'bg-buzzer text-ink' : 'bg-sunk/60'
      } ${entry.connected ? '' : 'opacity-60'}`}
    >
      <span className="w-6 text-right font-display text-lg font-extrabold tabular-nums">{entry.rank}</span>
      <span className="min-w-0 flex-1 truncate font-semibold">
        {entry.username}
        {isMe && ' (you)'}
        {!entry.connected && <span className="ml-2 text-xs font-normal">offline</span>}
      </span>
      <span className="font-display font-extrabold tabular-nums">{entry.score.toLocaleString()}</span>
    </li>
  );
}
