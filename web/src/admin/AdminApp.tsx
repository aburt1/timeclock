import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import Timesheet from './Timesheet';
import Roster from './Roster';
import Reports from './Reports';

type Tab = 'timesheet' | 'reports' | 'roster';

export default function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('timesheet');

  useEffect(() => {
    api
      .me()
      .then(({ authed }) => setAuthed(authed))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <Shell>
        <p className="text-rtc-gray font-bold mt-20 text-center">Loading…</p>
      </Shell>
    );
  }

  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  return (
    <Shell>
      <header className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-black text-rtc-green-dark mr-auto">
          ♻️ Time Clock — Teacher Admin
        </h1>
        <nav className="flex gap-1 bg-white rounded-xl p-1 shadow-sm">
          <TabButton active={tab === 'timesheet'} onClick={() => setTab('timesheet')}>
            Timesheet
          </TabButton>
          <TabButton active={tab === 'reports'} onClick={() => setTab('reports')}>
            Reports
          </TabButton>
          <TabButton active={tab === 'roster'} onClick={() => setTab('roster')}>
            Students
          </TabButton>
        </nav>
        <Link
          to="/"
          className="font-bold text-sm bg-white rounded-xl px-4 py-2 shadow-sm text-rtc-ink no-underline"
        >
          Open Kiosk →
        </Link>
        <button
          type="button"
          onClick={() => api.logout().then(() => setAuthed(false))}
          className="font-bold text-sm bg-white rounded-xl px-4 py-2 shadow-sm text-rtc-gray"
        >
          Log out
        </button>
      </header>
      {tab === 'timesheet' ? <Timesheet /> : tab === 'reports' ? <Reports /> : <Roster />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-rtc-sky1 to-rtc-sky2">
      <div className="max-w-6xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-bold text-sm rounded-lg px-4 py-2 ${
        active ? 'bg-rtc-green text-white' : 'text-rtc-gray'
      }`}
    >
      {children}
    </button>
  );
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="max-w-sm mx-auto mt-24 bg-white rounded-3xl shadow-lg p-8">
        <h1 className="text-xl font-black text-rtc-green-dark mb-1">♻️ Teacher Admin</h1>
        <p className="text-sm text-rtc-gray font-bold mb-6">
          Enter the admin password to manage the time clock.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="border-2 border-slate-300 rounded-xl px-4 py-3 font-bold"
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="bg-rtc-green text-white font-black rounded-xl py-3 disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Log in'}
          </button>
          {error && <p className="text-rtc-red font-bold text-sm">{error}</p>}
        </form>
        <p className="text-xs text-rtc-gray mt-6">
          The password is the <code>ADMIN_PASSWORD</code> environment variable on the server.
        </p>
        <Link to="/" className="block text-sm font-bold text-rtc-gray mt-2 no-underline">
          ← Back to kiosk
        </Link>
      </div>
    </Shell>
  );
}
