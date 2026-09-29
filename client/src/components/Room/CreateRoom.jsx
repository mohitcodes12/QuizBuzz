import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import QuizEditor from './QuizEditor.jsx';
import { sampleQuiz } from './sampleQuiz.js';

// "Host a game": pick one of your quizzes (or make one), then create a room.
export default function CreateRoom() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState(null); // null = still loading
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | quiz object
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { quizzes } = await api('/quiz');
      setQuizzes(quizzes);
      setSelectedId((id) => (quizzes.some((q) => q._id === id) ? id : quizzes[0]?._id ?? null));
    } catch (err) {
      setError(err.message);
      setQuizzes([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveQuiz(data) {
    if (editing && editing !== 'new') await api(`/quiz/${editing._id}`, { method: 'PUT', body: data });
    else await api('/quiz', { method: 'POST', body: data });
    setEditing(null);
    await load();
  }

  async function addSample() {
    setError('');
    try {
      const { quiz } = await api('/quiz', { method: 'POST', body: sampleQuiz });
      await load();
      setSelectedId(quiz._id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeQuiz(quiz) {
    if (!window.confirm(`Delete "${quiz.title}"?`)) return;
    try {
      await api(`/quiz/${quiz._id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createRoom() {
    setError('');
    setBusy(true);
    try {
      const { code } = await api('/rooms', { method: 'POST', body: { quizId: selectedId } });
      navigate(`/room/${code}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <section className="panel" aria-labelledby="editor-title">
        <h2 id="editor-title" className="mb-4 text-2xl font-extrabold">{editing === 'new' ? 'New quiz' : 'Edit quiz'}</h2>
        <QuizEditor initial={editing === 'new' ? null : editing} onSave={saveQuiz} onCancel={() => setEditing(null)} />
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="host-title">
      <h2 id="host-title" className="text-2xl font-extrabold">Host a game</h2>
      <p className="mt-1 text-muted">Pick a quiz, then share the room code with your players.</p>

      {quizzes === null ? (
        <p className="mt-5 text-muted">Loading your quizzes…</p>
      ) : quizzes.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-line p-5">
          <p className="font-semibold">You have no quizzes yet.</p>
          <p className="mt-1 text-sm text-muted">Add the 8-question sample to try a game right now, or write your own.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={addSample}>Add sample quiz</button>
            <button className="btn btn-ghost" onClick={() => setEditing('new')}>Write my own</button>
          </div>
        </div>
      ) : (
        <>
          <fieldset className="mt-5">
            <legend className="sr-only">Choose a quiz</legend>
            <ul className="space-y-2">
              {quizzes.map((q) => (
                <li key={q._id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${selectedId === q._id ? 'border-buzzer bg-buzzer/10' : 'border-line'}`}>
                  <input type="radio" id={`quiz-${q._id}`} name="quiz" className="h-5 w-5 accent-buzzer" checked={selectedId === q._id} onChange={() => setSelectedId(q._id)} />
                  <label htmlFor={`quiz-${q._id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block truncate font-semibold">{q.title}</span>
                    <span className="text-sm text-muted">{q.questions.length} question{q.questions.length === 1 ? '' : 's'}</span>
                  </label>
                  <button className="text-sm font-semibold underline underline-offset-4" onClick={() => setEditing(q)}>Edit</button>
                  <button className="text-sm font-semibold text-danger underline underline-offset-4" onClick={() => removeQuiz(q)}>Delete</button>
                </li>
              ))}
            </ul>
          </fieldset>

          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={createRoom} disabled={busy || !selectedId}>
              {busy ? 'Creating room…' : 'Create room'}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditing('new')}>New quiz</button>
            <button className="btn btn-ghost" onClick={addSample}>Add sample quiz</button>
          </div>
        </>
      )}

      {error && <p role="alert" className="mt-4 rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
