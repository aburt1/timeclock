import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type AdminStudent, type Session } from '../lib/api';
import {
  combineLocalDateTime,
  dayEndIso,
  dayStartIso,
  fmtDate,
  fmtDuration,
  fmtTime,
  isoToLocalDay,
  isoToTimeInput,
  localDateString,
  sessionMinutes,
} from '../lib/format';
import { ShapeIcon } from '../lib/shapes';

type EditDraft = {
  id: number;
  day: string; // local date the punches stay anchored to
  inTime: string;
  outTime: string;
  note: string;
};

export default function Timesheet() {
  const [from, setFrom] = useState(localDateString(-13));
  const [to, setTo] = useState(localDateString(0));
  const [studentFilter, setStudentFilter] = useState('');
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
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

  function startEdit(s: Session) {
    setError('');
    setDraft({
      id: s.id,
      day: isoToLocalDay(s.clockIn ?? s.clockOut ?? new Date().toISOString()),
      inTime: isoToTimeInput(s.clockIn),
      outTime: isoToTimeInput(s.clockOut),
      note: s.note,
    });
  }

  async function saveDraft() {
    if (!draft) return;
    setError('');
    try {
      await api.updateSession(draft.id, {
        clockIn: combineLocalDateTime(draft.day, draft.inTime),
        clockOut: combineLocalDateTime(draft.day, draft.outTime),
        note: draft.note,
      });
      setDraft(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function clockOutNow(s: Session) {
    setError('');
    try {
      await api.updateSession(s.id, { clockOut: new Date().toISOString() });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function remove(session: Session) {
    const label = `${session.studentName} on ${fmtDate(session.clockIn ?? session.clockOut ?? '')}`;
    if (!window.confirm(`Delete this entry for ${label}? This can't be undone.`)) return;
    await api.deleteSession(session.id);
    load();
  }

  const draftMinutes =
    draft && draft.inTime && draft.outTime
      ? sessionMinutes(
          combineLocalDateTime(draft.day, draft.inTime),
          combineLocalDateTime(draft.day, draft.outTime)
        )
      : null;

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
            onClick={() => setAdding(true)}
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
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {sessions === null ? (
              <tr>
                <td colSpan={7} className="p-6 text-center font-bold text-rtc-gray">
                  Loading…
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center font-bold text-rtc-gray">
                  No entries in this date range.
                </td>
              </tr>
            ) : (
              sessions.map((s) => {
                const isEditing = draft?.id === s.id;
                const mins = sessionMinutes(s.clockIn, s.clockOut);
                const anchor = s.clockIn ?? s.clockOut;

                if (isEditing && draft) {
                  return (
                    <tr key={s.id} className="border-b border-slate-100 bg-blue-50/60">
                      <td className="p-3 font-bold whitespace-nowrap">
                        {anchor ? fmtDate(anchor) : '—'}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-2 font-bold">
                          <ShapeIcon shape={s.shape} color={s.color} className="w-5 h-5" />
                          {s.studentName}
                        </span>
                      </td>
                      <td className="p-2">
                        <input
                          type="time"
                          autoFocus
                          value={draft.inTime}
                          onChange={(e) => setDraft({ ...draft, inTime: e.target.value })}
                          className="border-2 border-blue-300 rounded-lg px-2 py-1 font-bold w-28"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="time"
                          value={draft.outTime}
                          onChange={(e) => setDraft({ ...draft, outTime: e.target.value })}
                          className="border-2 border-blue-300 rounded-lg px-2 py-1 font-bold w-28"
                        />
                      </td>
                      <td className="p-3 font-bold whitespace-nowrap">
                        {draftMinutes !== null
                          ? draftMinutes >= 0
                            ? fmtDuration(draftMinutes)
                            : '⚠ out is before in'
                          : '—'}
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={draft.note}
                          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                          placeholder="note"
                          className="border-2 border-blue-200 rounded-lg px-2 py-1 w-full min-w-24"
                        />
                      </td>
                      <td className="p-2 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={saveDraft}
                          disabled={draftMinutes !== null && draftMinutes < 0}
                          className="bg-rtc-green text-white font-bold rounded-lg px-4 py-1.5 mr-2 disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraft(null)}
                          className="font-bold text-rtc-gray"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  );
                }

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
                        <span className="inline-flex items-center gap-2">
                          <span className="text-rtc-green font-bold">● still in</span>
                          <button
                            type="button"
                            onClick={() => clockOutNow(s)}
                            className="bg-rtc-red text-white text-xs font-bold rounded-lg px-2.5 py-1"
                            title="Set clock-out to right now"
                          >
                            Out now
                          </button>
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold whitespace-nowrap">
                      {mins !== null ? fmtDuration(mins) : '—'}
                    </td>
                    <td className="p-3 max-w-56 truncate" title={s.note}>
                      {s.note}
                    </td>
                    <td className="p-3 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
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

      <p className="text-xs text-rtc-gray font-bold">
        Click <span className="text-blue-700">Edit</span> to fix times right in the row — times
        stay on the same day. Use <span className="text-rtc-red">Out now</span> to close a
        forgotten clock-out.
      </p>

      {adding && (
        <AddEntryModal
          students={students}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddEntryModal({
  students,
  onClose,
  onSaved,
}: {
  students: AdminStudent[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [studentId, setStudentId] = useState(students.find((s) => s.active)?.id ?? 0);
  const [day, setDay] = useState(localDateString(0));
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createSession({
        studentId,
        clockIn: combineLocalDateTime(day, inTime),
        clockOut: combineLocalDateTime(day, outTime),
        note,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(15,30,45,0.55)] flex items-center justify-center p-4">
      <form onSubmit={save} className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-md flex flex-col gap-4">
        <h2 className="text-lg font-black text-rtc-green-dark">Add a timesheet entry</h2>

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

        <label className="text-sm font-bold flex flex-col gap-1">
          Day
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="border-2 border-slate-300 rounded-lg px-3 py-2 font-bold"
          />
        </label>

        <div className="flex gap-3">
          <label className="text-sm font-bold flex flex-col gap-1 flex-1">
            Clock in
            <input
              type="time"
              value={inTime}
              onChange={(e) => setInTime(e.target.value)}
              className="border-2 border-slate-300 rounded-lg px-3 py-2 font-bold"
            />
          </label>
          <label className="text-sm font-bold flex flex-col gap-1 flex-1">
            Clock out
            <input
              type="time"
              value={outTime}
              onChange={(e) => setOutTime(e.target.value)}
              className="border-2 border-slate-300 rounded-lg px-3 py-2 font-bold"
            />
          </label>
        </div>

        <label className="text-sm font-bold flex flex-col gap-1">
          Note
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="optional"
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
            disabled={busy || (!inTime && !outTime)}
            className="bg-rtc-green text-white font-bold rounded-xl px-6 py-2 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
