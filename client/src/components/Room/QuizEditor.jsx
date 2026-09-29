import { useState } from 'react';

const blankQuestion = () => ({ text: '', options: ['', '', '', ''], correctIndex: 0, timeLimitSec: 20 });
const TIME_CHOICES = [10, 15, 20, 30, 45, 60];

// Form for creating or editing a quiz. It only manages form state;
// saving (the API call) is done by the parent through onSave.
export default function QuizEditor({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [questions, setQuestions] = useState(
    initial?.questions?.map((q) => ({ ...q, options: [...q.options] })) || [blankQuestion()]
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const updateQuestion = (i, patch) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const updateOption = (i, o, value) =>
    setQuestions((qs) =>
      qs.map((q, idx) => (idx === i ? { ...q, options: q.options.map((x, k) => (k === o ? value : x)) } : q))
    );

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('Give your quiz a title');
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) return setError(`Question ${i + 1} needs some text`);
      if (q.options.some((o) => !o.trim())) return setError(`Question ${i + 1} needs all 4 options filled in`);
    }
    setBusy(true);
    try {
      await onSave({ title: title.trim(), questions });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="quiz-title" className="mb-1 block text-sm font-semibold">Quiz title</label>
        <input id="quiz-title" className="field" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      {questions.map((q, i) => (
        <fieldset key={i} className="rounded-xl border border-line bg-sunk/50 p-4">
          <legend className="px-1 font-display text-lg font-extrabold">Question {i + 1}</legend>
          <label htmlFor={`q-${i}`} className="sr-only">Question {i + 1} text</label>
          <input id={`q-${i}`} className="field" placeholder="Type your question" value={q.text} onChange={(e) => updateQuestion(i, { text: e.target.value })} />

          <p className="mb-2 mt-4 text-sm text-muted">Fill in 4 answers and select the correct one.</p>
          <div className="space-y-2">
            {q.options.map((opt, o) => (
              <div key={o} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${i}`}
                  checked={q.correctIndex === o}
                  onChange={() => updateQuestion(i, { correctIndex: o })}
                  aria-label={`Option ${o + 1} is correct`}
                  className="h-5 w-5 shrink-0 accent-buzzer"
                />
                <input className="field py-2" placeholder={`Answer ${o + 1}`} aria-label={`Question ${i + 1} answer ${o + 1}`} value={opt} onChange={(e) => updateOption(i, o, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              Time limit
              <select className="field w-auto py-1.5" value={q.timeLimitSec} onChange={(e) => updateQuestion(i, { timeLimitSec: Number(e.target.value) })}>
                {TIME_CHOICES.map((t) => <option key={t} value={t}>{t} seconds</option>)}
              </select>
            </label>
            {questions.length > 1 && (
              <button type="button" className="text-sm font-semibold text-danger underline underline-offset-4" onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}>
                Remove question
              </button>
            )}
          </div>
        </fieldset>
      ))}

      <button type="button" className="btn btn-ghost w-full" onClick={() => setQuestions((qs) => [...qs, blankQuestion()])} disabled={questions.length >= 50}>
        Add a question
      </button>

      {error && <p role="alert" className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" className="btn btn-primary flex-1" disabled={busy}>{busy ? 'Saving…' : 'Save quiz'}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
