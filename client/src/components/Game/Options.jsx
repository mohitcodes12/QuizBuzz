// Four answer buttons. Each has its own colour AND shape, so the options are
// distinguishable without relying on colour alone (colour-blind friendly).
const Triangle = () => <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden><path d="M12 3 22 21H2z" fill="currentColor" /></svg>;
const Diamond = () => <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden><path d="M12 2 22 12 12 22 2 12z" fill="currentColor" /></svg>;
const Circle = () => <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden><circle cx="12" cy="12" r="10" fill="currentColor" /></svg>;
const Square = () => <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" /></svg>;

const STYLES = [
  { bg: 'bg-coral', Shape: Triangle },
  { bg: 'bg-sky', Shape: Diamond },
  { bg: 'bg-mint', Shape: Circle },
  { bg: 'bg-lilac', Shape: Square },
];

// props:
//   selected  - option index this player chose (or null)
//   locked    - true once answered or when time is up (buttons disabled)
//   reveal    - null during the question; { correctIndex, answerCounts } after it ends
export default function Options({ options, selected, locked, reveal, onPick }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Answer options">
      {options.map((text, i) => {
        const { bg, Shape } = STYLES[i];
        const isCorrect = reveal?.correctIndex === i;
        const isMyWrong = reveal && selected === i && !isCorrect;
        const isMine = selected === i;

        let state = '';
        if (reveal) state = isCorrect ? 'ring-4 ring-paper' : 'opacity-40';
        else if (locked && !isMine) state = 'opacity-50';
        else if (isMine) state = 'ring-4 ring-paper';

        return (
          <button
            key={i}
            type="button"
            disabled={locked}
            onClick={() => onPick(i)}
            aria-pressed={isMine}
            className={`${bg} ${state} flex min-h-[4.5rem] items-center gap-3 rounded-xl px-4 py-3 text-left font-display text-lg font-bold text-ink transition-transform enabled:active:scale-[0.98] disabled:cursor-default sm:min-h-[6rem] sm:text-xl ${
              isMyWrong ? 'outline-dashed outline-4 outline-offset-[-4px] outline-danger' : ''
            }`}
          >
            <Shape />
            <span className="min-w-0 flex-1 break-words">{text}</span>
            {reveal && isCorrect && <span className="shrink-0 rounded bg-ink px-2 py-0.5 text-sm text-paper">Correct</span>}
            {isMyWrong && <span className="shrink-0 rounded bg-ink px-2 py-0.5 text-sm text-paper">Your pick</span>}
            {reveal && <span className="shrink-0 text-sm font-semibold tabular-nums">{reveal.answerCounts[i]}</span>}
            {!reveal && isMine && <span className="shrink-0 rounded bg-ink px-2 py-0.5 text-sm text-paper">Locked in</span>}
          </button>
        );
      })}
    </div>
  );
}
