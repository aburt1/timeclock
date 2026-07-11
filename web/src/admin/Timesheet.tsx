import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type AdminStudent, type Session } from '../lib/api';
import {
  dayEndIso,
  dayStartIso,
  fmtDate,
  fmtDuration,
  fmtTime,
  isoToLocalInput,
  localDateString,
  localInputToIso,
  sessionMinutes,
} from '../lib/format';
import { ShapeIcon } from '../lib/shapes';

type Editing =
  | { mode: 'edit'; session: Session }
  | { mode: 'new' }
  | null;

export default function Timesheet() {
  const [from, setFrom] = useState(localDateString(-13));
  const [to, setTo] = useState(localDateString(0));
  const [studentFilter, setStudentFilter] = useState('');
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [{ sessions }, { students }] = await Promise.all([
        api.sessions({
          from: dayStartIso(from),
          to: dayEndIso(to),
          studentId: studentFilter || undefined,
        }),
        api.students(),
      ]);
      setSessions(sessions);
      setStudents(students);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [from, to, studentFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const map = new Map<
      number,
      { name: string; shape: string; color: string; minutes: number; open: number; flagged: number }
    >();
    for (const s of sessions ?? []) {
      const entry =
        map.get(s.studentId) ??
        { name: s.studentName, shape: s.shape, color: s.color, minutes: 0, open: 0, flagged: 0 };
      const mins = sessionMinutes(s.clockIn, s.clockOut);
      if (mins !== null) entry.minutes += mins;
      if (s.clockIn && !s.clockOut) entry.open += 1;
      if (!s.clockIn && s.clockOut) entry.flagged += 1;
      map.set(s.studentId, entry);
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes);
  }, [sessions]);

  async function remove(session: Session) {
    const label = `${session.studentName} on ${fmtDate(session.clockIn ?? session.clockOut ?? '')}`;
    if (!window.confirm(`Delete this entry for ${label}? This can't be undone.`)) return;
    await api.deleteSession(session.id);
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-wrap items-end gap-4">
        <label className="text-sm font-bold flex flex-col gap-1">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border-2 border-slate-300 rounded-lg px-3 py-1.5 font-bold"
          />
        </label>
        <label className="text-sm font-bold flex flex-col gap-1">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border-2 border-slate-300 rounded-lg px-3 py-1.5 font-bold"
          />
        </label>
        <label className="text-sm font-bold flex flex-col gap-1">
          Student
          <select
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            className="border-2 border-slate-300 rounded-lg px-3 py-2 font-bold bg-white"
          >
            <option value="">All students</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={() => setEditing({ mode: 'new' })}
            className="bg-rtc-green text-white font-bold rounded-xl px-4 py-2"
          >
            + Add entry
          </button>
          <a
            href={api.exportCsvUrl({
              from: dayStartIso(from),
              to: dayEndIso(to),
              studentId: studentFilter || undefined,
            })}
            className="bg-white border-2 border-rtc-green text-rtc-green-dark font-bold rounded-xl px-4 py-2 no-underline"
          >
            ⬇ Export CSV
          </a>
          <a
            href={api.exportCsvUrl({})}
            className="bg-white border-2 border-slate-300 text-rtc-gray font-bold rounded-xl px-4 py-2 no-underline"
            title="Every record ever, all students"
          >
            Export all
          </a>
        </div>
      </div>

      {error && <p className="text-rtc-red font-bold">{error}</p>}

      {/* Totals */}
      {totals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {totals.map((t) => (
            <div key={t.name} className="bg-white rounded-2xl shadow-sm p-3 flex items-center gap-3">
              <ShapeIcon shape={t.shape} color={t.color} className="w-10 h-10 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold truncate">{t.name}</div>
                <div className="text-sm font-black text-rtc-green-dark">
                  {fmtDuration(t.minutes)}
                </div>
                {t.open > 0 && (
                  <div className="text-xs font-bold text-rtc-green">● still clocked in</div>
                )}
                {t.flagged > 0 && (
                  <div className="text-xs font-bold text-amber-600">⚠ needs a fix</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sessions table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-rtc-gray border-b-2 border-slate-100">
              <th className="p-3">Date</th>
              <th className="p-3">Student</th>
              <th className="p-3">In</th>
              <th className="p-3">Out</th>
              <th className="p-3">Time worked</th>
              <th className="p-3">Note</th>
              <th className="p-3">Source</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {sessions === null ? (
              <tr>
                <td colSpan={8} className="p-6 text-center font-bold text-rtc-gray">
                  Loading…
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center font-bold text-rtc-gray">
                  No entries in this date range.
                </td>
              </tr>
            ) : (
              sessions.map((s) => {
                const mins = sessionMinutes(s.clockIn, s.clockOut);
                const anchor = s.clockIn ?? s.clockOut;
                return (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="p-3 font-bold whitespace-nowrap">
                      {anchor ? fmtDate(anchor) : '—'}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2 font-bold">
                        <ShapeIcon shape={s.shape} color={s.color} className="w-5 h-5" />
                        {s.studentName}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {s.clockIn ? (
                        fmtTime(s.clockIn)
                      ) : (
                        <span className="text-amber-600 font-bold">⚠ missing</span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {s.clockOut ? (
                        fmtTime(s.clockOut)
                      ) : (
                        <span className="text-rtc-green font-bold">● still in</span>
                      )}
                    </td>
                    <td className="p-3 font-bold whitespace-nowrap">
                      {mins !== null ? fmtDuration(mins) : '—'}
                    </td>
                    <td className="p-3 max-w-56 truncate" title={s.note}>
                      {s.note}
                    </td>
                    <td className="p-3 text-rtc-gray">{s.createdVia}</td>
                    <td className="p-3 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => setEditing({ mode: 'edit', session: s })}
                        className="font-bold text-blue-700 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(s)}
                        className="font-bold text-rtc-red"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <SessionModal
          editing={editing}
          students={students}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function SessionModal({
  editing,
  students,
  onClose,
  onSaved,
}: {
  editing: NonNullable<Editing>;
  students: AdminStudent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const session = editing.mode === 'edit' ? editing.session : null;
  const [studentId, setStudentId] = useState(
    session?.studentId ?? students.find((s) => s.active)?.id ?? 0
  );
  const [clockIn, setClockIn] = useState(isoToLocalInput(session?.clockIn ?? null));
  const [clockOut, setClockOut] = useState(isoToLocalInput(session?.clockOut ?? null));
  const [note, setNote] = useState(session?.note ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (session) {
        await api.updateSession(session.id, {
          clockIn: localInputToIso(clockIn),
          clockOut: localInputToIso(clockOut),
          note,
        });
      } else {
        await api.createSession({
          studentId,
          clockIn: localInputToIso(clockIn),
          clockOut: localInputToIso(clockOut),
          note,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,30,45,0.55)] flex items-center justify-center p-4">
      <form onSubmit={save} className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-md flex flex-col gap-4">
        <h2 className="text-lg font-black text-rtc-green-dark">
          {session ? `Edit entry — ${session.studentName}` : 'Add a timesheet entry'}
        </h2>

        {!session && (
          <label className="text-sm font-bold flex flex-col gap-1">
            Student
            <select
              value={studentId}
              onChange={(e) => setStudentId(Number(e.target.value))}
              className="border-2 border-slate-300 rounded-lg px-3 py-2 font-bold bg-white"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="text-sm font-bold flex flex-col gap-1">
          Clock in
          <input
            type="datetime-local"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            className="border-2 border-slate-300 rounded-lg px-3 py-2 font-bold"
          />
        </label>
        <label className="text-sm font-bold flex flex-col gap-1">
          Clock out <span className="font-normal text-rtc-gray">(leave empty if still working)</span>
          <input
            type="datetime-local"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            className="border-2 border-slate-300 rounded-lg px-3 py-2 font-bold"
          />
        </label>
        <label className="text-sm font-bold flex flex-col gap-1">
          Note
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. forgot to clock out, left early"
            className="border-2 border-slate-300 rounded-lg px-3 py-2"
          />
        </label>

        {error && <p className="text-rtc-red font-bold text-sm">{error}</p>}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-rtc-gray rounded-xl px-4 py-2 border-2 border-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-rtc-green text-white font-bold rounded-xl px-6 py-2 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
