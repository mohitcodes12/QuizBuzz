import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Login from './components/Auth/Login.jsx';
import Register from './components/Auth/Register.jsx';
import Home from './components/Room/Home.jsx';
import RoomView from './components/Room/RoomView.jsx';

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-2xl font-extrabold">
      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-buzzer">
        <span className="h-3.5 w-3.5 rounded-full bg-stage" />
      </span>
      QuizBuzz
    </Link>
  );
}

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="flex h-16 items-center justify-between border-b border-line px-4">
      <Brand />
      {user && (
        <div className="flex items-center gap-3">
          <span className="hidden font-semibold sm:inline">{user.username}</span>
          <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={logout}>Log out</button>
        </div>
      )}
    </header>
  );
}

// Only logged-in users get through. Others go to /login and come back afterwards
// (that's how a shared room link works for someone who isn't logged in yet).
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status" className="p-8 text-center text-muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/room/:code" element={<ProtectedRoute><RoomView /></ProtectedRoute>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
