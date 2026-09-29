import { Link } from 'react-router-dom';

// Shared frame for Login and Register
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-4xl font-extrabold">{title}</h1>
      <p className="mt-2 text-muted">{subtitle}</p>
      <div className="panel mt-8">{children}</div>
      <p className="mt-6 text-center text-muted">{footer}</p>
    </main>
  );
}

export function AuthLink({ to, state, children }) {
  return (
    <Link to={to} state={state} className="font-semibold text-buzzer underline underline-offset-4">
      {children}
    </Link>
  );
}
