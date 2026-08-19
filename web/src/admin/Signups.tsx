import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, bLabel, type Campus, type Day, type Group, type Signup } from '../lib/api';
import { CartoonMap } from './CartoonMap';

// Group A is crimson (a green route is invisible on the map's grass).
const GROUP_TEXT: Record<Group, string> = { A: 'text-rose-700', B: 'text-blue-700' };
const GROUP_BG: Record<Group, string> = { A: 'bg-rose-50 border-rose-200', B: 'bg-blue-50 border-blue-200' };

function todayView(days: Day[]): Day | 'week' {
  const d = new Date().getDay(); // 0 Sun … 6 Sat
  return d >= 1 && d <= 5 ? days[d - 1] : 'week';
}

export default function Signups() {
  const [campus, setCampus] = useState<Campus | null>(null);
  const [signups, setSignups] = useState<Signup[] | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<Day | 'week' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [c, s] = await Promise.all([api.campus(), api.signups()]);
      setCampus(c);
      setSignups(s.signups);
      setView((v) => v ?? todayView(c.days));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const list = signups ?? [];
    return {
      total: list.length,
      a: list.filter((s) => s.group === 'A').length,
      b: list.filter((s) => s.group === 'B').length,
      unscheduled: list.filter((s) => !s.day || !s.group),
    };
  }, [signups]);

  async function update(id: number, patch: Parameters<typeof api.updateSignup>[1]) {
    setError('');
    try {
      await api.updateSignup(id, patch);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function remove(s: Signup) {
    if (!window.confirm(`Remove ${s.name} (${s.roomLabel})? This can't be undone.`)) return;
    await api.deleteSignup(s.id);
    load();
  }

  const signupUrl = `${window.location.origin}/signup`;

  if (!campus || !signups || !view) {
    return error ? (
      <p className="text-rtc-red font-bold">{error}</p>
    ) : (
      <p className="font-bold text-rtc-gray">Loading…</p>
    );
  }

  const visible = selected ? signups.filter((s) => s.building === selected) : signups;

  return (
    <div className="flex flex-col gap-5">
      {/* Top bar: stats + actions */}
      <div className="grid grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-3 items-stretch">
        <Stat label="Total sign-ups" value={stats.total} />
        <Stat label="Group A · slow walkers" value={stats.a} tone="A" />
        <Stat label="Group B · standard route" value={stats.b} tone="B" />
        <div className="col-span-3 lg:col-span-1 bg-white rounded-2xl shadow-sm p-3 flex flex-wrap lg:flex-col gap-2 justify-center">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(signupUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className="bg-rtc-green text-white font-bold rounded-xl px-4 py-2 text-sm"
            title={signupUrl}
          >
            {copied ? '✓ Copied!' : '🔗 Copy sign-up link'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              className="flex-1 bg-white border-2 border-slate-300 text-rtc-gray font-bold rounded-xl px-3 py-2 text-sm"
            >
              ↻ Refresh
            </button>
            <a
              href={api.signupsCsvUrl}
              className="flex-1 text-center bg-white border-2 border-rtc-green text-rtc-green-dark font-bold rounded-xl px-3 py-2 text-sm no-underline"
            >
              ⬇ CSV
            </a>
          </div>
        </div>
      </div>

      {error && <p className="text-rtc-red font-bold">{error}</p>}

      {stats.unscheduled.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-sm font-bold text-amber-800">
          ⚠ {stats.unscheduled.length} sign-up{stats.unscheduled.length === 1 ? '' : 's'} can't be
          placed on the schedule — set a Day and Group in the table below:{' '}
          {stats.unscheduled.map((s) => `${s.name} (${s.roomLabel})`).join(', ')}
        </div>
      )}

      {/* Map */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-black text-rtc-ink mb-3">Pickup routes</h2>
        <CartoonMap
          campus={campus}
          signups={signups}
          view={view}
          onViewChange={setView}
          selected={selected}
          onSelect={setSelected}
          onLabelsChange={(labels) => {
            setCampus({ ...campus, labels });
            load();
          }}
        />
      </section>

      {/* Weekly schedule */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="font-black text-rtc-ink mb-3">Weekly pickup schedule</h2>
        <div className="grid gap-3 md:grid-cols-5">
          {campus.days.map((day) => (
            <DayColumn key={day} day={day} campus={campus} signups={signups} />
          ))}
        </div>
      </section>

      {/* All sign-ups */}
      <section className="bg-white rounded-2xl shadow-sm overflow-x-auto">
        <div className="flex items-center gap-3 p-4 pb-2">
          <h2 className="font-black text-rtc-ink">
            {selected
              ? `Sign-ups in ${bLabel(campus, selected)}`
              : 'All sign-ups'}
          </h2>
          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs font-bold text-rtc-gray underline"
            >
              show all
            </button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-rtc-gray border-b-2 border-slate-100">
              <th className="p-3">Name</th>
              <th className="p-3">Location</th>
              <th className="p-3">Type</th>
              <th className="p-3">Day</th>
              <th className="p-3">Group</th>
              <th className="p-3">Submitted</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center font-bold text-rtc-gray">
                  {signups.length === 0
                    ? 'No sign-ups yet — share the sign-up link with staff.'
                    : 'No sign-ups in this building.'}
                </td>
              </tr>
            ) : (
              visible.map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="p-3 font-bold whitespace-nowrap">{s.name}</td>
                  <td className="p-3">
                    <div className="font-bold">
                      {s.roomLabel}
                      {s.roomDetail && <span className="text-rtc-gray font-normal"> — {s.roomDetail}</span>}
                    </div>
                    <div className="text-xs text-rtc-gray">
                      {s.buildingName}
                      {s.isCustom && (
                        <span className="ml-1 text-amber-700 font-bold" title="Custom location — nearest building chosen by the requester">
                          · custom
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 capitalize text-rtc-gray">{s.locationType}</td>
                  <td className="p-3">
                    <select
                      value={s.overrideDay ?? ''}
                      onChange={(e) => update(s.id, { overrideDay: (e.target.value || null) as Day | null })}
                      className={`border-2 rounded-lg px-2 py-1 font-bold bg-white ${
                        s.overrideDay ? 'border-amber-400' : 'border-slate-200'
                      }`}
                      title={s.overrideDay ? 'Manually set' : 'Automatic from building'}
                    >
                      <option value="">{s.day ? `${s.day} (auto)` : '— none —'}</option>
                      {campus.days.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <select
                      value={s.overrideGroup ?? ''}
                      onChange={(e) => update(s.id, { overrideGroup: (e.target.value || null) as Group | null })}
                      className={`border-2 rounded-lg px-2 py-1 font-bold bg-white ${
                        s.overrideGroup ? 'border-amber-400' : 'border-slate-200'
                      } ${s.group ? GROUP_TEXT[s.group] : ''}`}
                      title={s.overrideGroup ? 'Manually set' : 'Automatic from building'}
                    >
                      <option value="">{s.group ? `${s.group} (auto)` : '— none —'}</option>
                      <option value="A">A · slow walkers</option>
                      <option value="B">B · standard</option>
                    </select>
                  </td>
                  <td className="p-3 text-rtc-gray whitespace-nowrap">
                    {new Date(s.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => remove(s)} className="font-bold text-rtc-red">
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="text-xs text-rtc-gray font-bold p-4 pt-3">
          Day and Group are set automatically from the building. Pick a value to override it for that
          person (amber border = manually set). Overrides win over the automatic assignment.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: Group }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="text-xs font-bold text-rtc-gray">{label}</div>
      <div className={`text-3xl font-black mt-1 ${tone ? GROUP_TEXT[tone] : 'text-rtc-ink'}`}>{value}</div>
    </div>
  );
}

function DayColumn({ day, campus, signups }: { day: Day; campus: Campus; signups: Signup[] }) {
  const todays = signups.filter((s) => s.day === day);
  return (
    <div className="border-2 border-slate-100 rounded-2xl p-3 flex flex-col gap-3">
      <div className="font-black text-rtc-ink">{day}</div>
      {(['A', 'B'] as Group[]).map((g) => {
        const buildings = campus.buildings.filter((b) => b.day === day && b.group === g);
        const people = todays.filter((s) => s.group === g);
        return (
          <div key={g} className={`rounded-xl border-2 p-2.5 ${GROUP_BG[g]}`}>
            <div className={`text-xs font-black ${GROUP_TEXT[g]}`}>
              Group {g} · {buildings.map((b) => bLabel(campus, b)).join(' + ') || '—'}
            </div>
            {people.length === 0 ? (
              <div className="text-xs text-rtc-gray font-bold mt-1">No sign-ups yet</div>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-0.5">
                {people.map((s) => (
                  <li key={s.id} className="text-sm leading-tight">
                    <span className="font-bold">{s.roomLabel}</span>
                    <span className="text-rtc-gray"> · {s.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
