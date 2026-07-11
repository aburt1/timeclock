import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type KioskStudent, type PunchResult } from '../lib/api';
import { fmtDuration, fmtTime } from '../lib/format';
import { ShapeIcon } from '../lib/shapes';
import { flushQueue, queueSize, sendPunch } from './queue';

type Confirm = {
  student: KioskStudent;
  action: 'IN' | 'OUT';
  time: string;
  result: PunchResult | null;
  offline: boolean;
};

const IDLE_RESET_MS = 45_000;
const CONFIRM_AUTOCLOSE_MS = 6_000;

export default function KioskPage() {
  const [students, setStudents] = useState<KioskStudent[] | null>(null);
  const [selected, setSelected] = useState<KioskStudent | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [pending, setPending] = useState(queueSize());
  const [serverDown, setServerDown] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const { students } = await api.kioskState();
      setStudents(students);
      setServerDown(false);
    } catch {
      setServerDown(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const poll = window.setInterval(refresh, 30_000);
    const flush = window.setInterval(async () => {
      setPending(await flushQueue());
    }, 20_000);
    const onOnline = () => {
      flushQueue().then(setPending);
      refresh();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(flush);
      window.removeEventListener('online', onOnline);
    };
  }, [refresh]);

  // If a student walks away mid-flow, return to the name grid.
  useEffect(() => {
    if (!selected) return;
    const t = window.setTimeout(() => setSelected(null), IDLE_RESET_MS);
    return () => window.clearTimeout(t);
  }, [selected]);

  const closeConfirm = useCallback(() => {
    window.clearTimeout(confirmTimer.current);
    setConfirm(null);
    setSelected(null);
  }, []);

  async function punch(action: 'IN' | 'OUT') {
    if (!selected || busy) return;
    setBusy(true);
    const timestamp = new Date().toISOString();
    const { offline, result } = await sendPunch({
      clientEventId: crypto.randomUUID(),
      studentId: selected.id,
      action,
      timestamp,
    });
    setPending(queueSize());
    setConfirm({ student: selected, action, time: fmtTime(timestamp), result, offline });
    window.clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(closeConfirm, CONFIRM_AUTOCLOSE_MS);
    setBusy(false);
    refresh();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rtc-sky1 to-rtc-sky2 flex flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="text-xl md:text-2xl font-bold text-rtc-green-dark">
          ♻️ Recycling Time Clock
        </div>
        <Link
          to="/admin"
          aria-label="Teacher admin"
          title="Teacher admin"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/60 border-2 border-black/10 text-rtc-gray text-xl no-underline"
        >
          ⚙
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-6 w-full max-w-4xl mx-auto">
        {students === null ? (
          <p className="text-2xl font-bold text-rtc-gray mt-16">Loading…</p>
        ) : selected ? (
          <ActionScreen
            student={students.find((s) => s.id === selected.id) ?? selected}
            busy={busy}
            onPunch={punch}
            onBack={() => setSelected(null)}
          />
        ) : (
          <>
            <h1 className="text-3xl md:text-4xl font-black my-5 text-center">
              Who are you? Tap your name!
            </h1>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
              {students.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className="flex flex-col items-center gap-2 bg-white rounded-3xl border-4 border-transparent hover:border-blue-600 shadow-[0_4px_10px_rgba(0,0,0,0.08)] p-5 transition-transform active:scale-95"
                >
                  <ShapeIcon shape={s.shape} color={s.color} className="w-24 h-24 md:w-28 md:h-28" />
                  <span className="text-2xl md:text-3xl font-bold">{s.name}</span>
                  <span
                    className={`text-sm font-bold rounded-full px-3 py-1 ${
                      s.clockedIn
                        ? 'bg-green-100 text-rtc-green-dark'
                        : 'text-transparent select-none'
                    }`}
                  >
                    {s.clockedIn ? '✓ At work' : '.'}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="text-center pb-4 min-h-10 text-rtc-gray text-sm font-bold">
        {pending > 0 && (
          <div>
            ⏳ {pending} record{pending === 1 ? '' : 's'} saved here, waiting to sync…
          </div>
        )}
        {serverDown && <div>📡 Can't reach the server right now — taps are still being saved.</div>}
      </footer>

      {confirm && <ConfirmOverlay confirm={confirm} onClose={closeConfirm} />}
    </div>
  );
}

function ActionScreen({
  student,
  busy,
  onPunch,
  onBack,
}: {
  student: KioskStudent;
  busy: boolean;
  onPunch: (action: 'IN' | 'OUT') => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center w-full max-w-2xl mt-4">
      <ShapeIcon shape={student.shape} color={student.color} className="w-32 h-32 md:w-40 md:h-40" />
      <h1 className="text-4xl md:text-5xl font-black mt-3">Hi, {student.name}!</h1>
      <p className="text-xl md:text-2xl font-bold text-rtc-gray mt-2 min-h-8 text-center">
        {student.clockedIn && student.since
          ? `You clocked in at ${fmtTime(student.since)}.`
          : 'Ready to work?'}
      </p>

      <div className="flex flex-col sm:flex-row gap-6 w-full mt-8">
        <button
          type="button"
          disabled={busy}
          onClick={() => onPunch('IN')}
          className={`flex-1 flex flex-col items-center gap-2 text-white text-3xl md:text-4xl font-black rounded-3xl py-8 bg-rtc-green shadow-[0_8px_0_var(--color-rtc-green-dark)] active:translate-y-1.5 active:shadow-[0_2px_0_var(--color-rtc-green-dark)] transition-all disabled:opacity-50 ${
            student.clockedIn ? 'opacity-60 saturate-50' : ''
          }`}
        >
          <span className="text-5xl">✅</span>
          CLOCK IN
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onPunch('OUT')}
          className={`flex-1 flex flex-col items-center gap-2 text-white text-3xl md:text-4xl font-black rounded-3xl py-8 bg-rtc-red shadow-[0_8px_0_var(--color-rtc-red-dark)] active:translate-y-1.5 active:shadow-[0_2px_0_var(--color-rtc-red-dark)] transition-all disabled:opacity-50 ${
            !student.clockedIn ? 'opacity-60 saturate-50' : ''
          }`}
        >
          <span className="text-5xl">🛑</span>
          CLOCK OUT
        </button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-8 text-xl font-bold text-rtc-gray bg-white/70 border-2 border-black/10 rounded-2xl px-8 py-3"
      >
        ← That's not me — go back
      </button>
    </div>
  );
}

function confirmMessage(c: Confirm): { icon: string; text: string; sub?: string } {
  const { student, action, time, result, offline } = c;
  if (offline) {
    return {
      icon: action === 'IN' ? '✅' : '🛑',
      text: `${student.name}, you clocked ${action} at ${time}`,
      sub: 'Saved on this device — it will sync when the internet is back.',
    };
  }
  switch (result?.status) {
    case 'already_in':
      return {
        icon: '👍',
        text: `${student.name}, you're already clocked in!`,
        sub: result.since ? `Since ${fmtTime(result.since)}. You're all set.` : undefined,
      };
    case 'out':
      return {
        icon: '🛑',
        text: `${student.name}, you clocked OUT at ${time}`,
        sub:
          typeof result.minutes === 'number' && result.minutes > 0
            ? `Great job! You worked ${fmtDuration(result.minutes)}. 🎉`
            : undefined,
      };
    case 'out_no_in':
      return {
        icon: '🛑',
        text: `${student.name}, you clocked OUT at ${time}`,
        sub: "We didn't see a clock-in today — your teacher can fix that.",
      };
    default:
      return {
        icon: '✅',
        text: `${student.name}, you clocked IN at ${time}`,
        sub: 'Have a great shift!',
      };
  }
}

function ConfirmOverlay({ confirm, onClose }: { confirm: Confirm; onClose: () => void }) {
  const { icon, text, sub } = confirmMessage(confirm);
  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(15,30,45,0.55)] flex items-center justify-center p-6"
      role="alertdialog"
      aria-label={text}
    >
      <div className="bg-white rounded-[2rem] px-10 py-10 text-center max-w-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="text-7xl mb-3">{icon}</div>
        <div className="text-3xl font-bold leading-snug">{text}</div>
        {sub && <div className="text-xl font-bold text-rtc-gray mt-3">{sub}</div>}
        <button
          type="button"
          onClick={onClose}
          className="mt-8 text-2xl font-black text-white bg-rtc-green rounded-2xl px-14 py-4 shadow-[0_6px_0_var(--color-rtc-green-dark)] active:translate-y-1 active:shadow-[0_2px_0_var(--color-rtc-green-dark)] transition-all"
        >
          OK
        </button>
      </div>
    </div>
  );
}
