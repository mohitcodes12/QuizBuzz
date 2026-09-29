import Timer from './Timer.jsx';
import Question from './Question.jsx';
import Options from './Options.jsx';
import Leaderboard from '../Leaderboard/Leaderboard.jsx';

export default function GameScreen({ game, meId }) {
  const { phase, question, selected, answered, reveal, leaderboard, clockOffset, answer } = game;

  if (phase === 'starting' || !question) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-4 text-center">
        <div>
          <h1 className="text-4xl font-extrabold">Get ready</h1>
          <p className="mt-2 text-muted" role="status">The first question is on its way.</p>
        </div>
      </main>
    );
  }

  const inReveal = phase === 'reveal' && reveal;
  const mine = inReveal ? reveal.results[meId] : null;

  let status;
  if (inReveal) {
    if (!mine) status = 'Time ran out before you answered. No points this round.';
    else if (mine.points > 0) status = `Correct! +${mine.points.toLocaleString()} points`;
    else status = 'Not this time. 0 points.';
  } else if (answered) {
    status = 'Answer locked in. Waiting for the others…';
  } else {
    status = 'Pick an answer. The faster you get it right, the more points you earn.';
  }

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <Timer
          key={question.index}
          endsAt={question.endsAt}
          clockOffset={clockOffset}
          totalMs={question.timeLimitSec * 1000}
          running={phase === 'question'}
        />
        <Question index={question.index} total={question.total} text={question.text} />
        <Options
          options={question.options}
          selected={selected}
          locked={answered || phase !== 'question'}
          reveal={inReveal ? reveal : null}
          onPick={answer}
        />
        <p
          role="status"
          className={`rounded-xl px-4 py-3 font-semibold ${
            mine?.points > 0 ? 'bg-mint text-ink' : 'bg-raised/60'
          }`}
        >
          {status}
          {inReveal && <span className="block text-sm font-normal opacity-80">{reveal.isLast ? 'Final results are coming up…' : 'Next question in a moment…'}</span>}
        </p>
      </div>

      <Leaderboard entries={leaderboard} meId={meId} limit={8} />
    </main>
  );
}
