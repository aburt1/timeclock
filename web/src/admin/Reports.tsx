import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type Session } from '../lib/api';
import {
  dayEndIso,
  dayStartIso,
  fmtDuration,
  localDateString,
  sessionMinutes,
} from '../lib/format';
import { ShapeIcon } from '../lib/shapes';

/* Date-range presets */

function toDayString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

const PRESETS: Array<{ id: string; label: string; range: () => [string, string] }> = [
  {
    id: 'this-week',
    label: 'This week',
    range: () => [toDayString(mondayOf(new Date())), localDateString(0)],
  },
  {
    id: 'last-week',
    label: 'Last week',
    range: () => {
      const mon = mondayOf(new Date());
      const lastMon = new Date(mon);
      lastMon.setDate(mon.getDate() - 7);
      const lastSun = new Date(mon);
      lastSun.setDate(mon.getDate() - 1);
      return [toDayString(lastMon), toDayString(lastSun)];
    },
  },
  {
    id: 'this-month',
    label: 'This month',
    range: () => {
      const d = new Date();
      return [toDayString(new Date(d.getFullYear(), d.getMonth(), 1)), localDateString(0)];
    },
  },
  { id: 'last-30', label: 'Last 30 days', range: () => [localDateString(-29), localDateString(0)] },
];

export default function Reports() {
  const [preset, setPreset] = useState('this-week');
  const [[from, to], setRange] = useState<[string, string]>(PRESETS[0].range());
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.sessions({ from: dayStartIso(from), to: dayEndIso(to) });
      setSessions(res.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => computeStats(sessions ?? [], from, to), [sessions, from, to]);

  return (
    <div className="flex flex-col gap-5">
      {/* Range controls */}
      <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPreset(p.id);
                setRange(p.range());
              }}
              className={`text-sm font-bold rounded-xl px-4 py-2 border-2 ${
                preset === p.id
                  ? 'bg-rtc-green border-rtc-green text-white'
                  : 'bg-white border-slate-200 text-rtc-gray'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-3 ml-auto">
          <label className="text-sm font-bold flex flex-col gap-1">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset('custom');
                setRange([e.target.value, to]);
              }}
              className="border-2 border-slate-300 rounded-lg px-3 py-1.5 font-bold"
            />
          </label>
          <label className="text-sm font-bold flex flex-col gap-1">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset('custom');
                setRange([from, e.target.value]);
              }}
              className="border-2 border-slate-300 rounded-lg px-3 py-1.5 font-bold"
            />
          </label>
          <a
            href={api.exportCsvUrl({ from: dayStartIso(from), to: dayEndIso(to) })}
            className="bg-white border-2 border-rtc-green text-rtc-green-dark font-bold rounded-xl px-4 py-2 no-underline text-sm"
          >
            ⬇ Export CSV
          </a>
        </div>
      </div>

      {error && <p className="text-rtc-red font-bold">{error}</p>}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total hours worked" value={fmtDuration(stats.totalMinutes)} />
        <StatTile label="Work sessions" value={String(stats.completedCount)} />
        <StatTile label="Students who worked" value={String(stats.perStudent.length)} />
        <StatTile
          label="Needs attention"
          value={String(stats.openCount + stats.missingInCount)}
          sub={
            stats.openCount + stats.missingInCount > 0
              ? `${stats.openCount} still clocked in · ${stats.missingInCount} missing a clock-in`
              : 'All punches look complete'
          }
          alert={stats.missingInCount > 0}
        />
      </div>

      {sessions !== null && stats.totalMinutes === 0 && stats.completedCount === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center font-bold text-rtc-gray">
          No hours recorded between {from} and {to} yet.
        </div>
      ) : (
        <>
          {/* Hours per student */}
          <section className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-black text-rtc-ink mb-4">Hours by student</h2>
            <div className="flex flex-col gap-2.5">
              {stats.perStudent.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="flex items-center gap-2 w-32 shrink-0 font-bold text-sm">
                    <ShapeIcon shape={s.shape} color={s.color} className="w-5 h-5 shrink-0" />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-rtc-green rounded-r-md"
                      style={{ width: `${(s.minutes / stats.maxStudentMinutes) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums">
                    {fmtDuration(s.minutes)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Hours per day / week */}
          <section className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-black text-rtc-ink mb-1">
              Hours by {stats.weekly ? 'week' : 'day'}
            </h2>
            <BucketChart buckets={stats.buckets} />
          </section>
        </>
      )}

      <p className="text-xs text-rtc-gray font-bold">
        Hours count completed sessions only — anything still open or missing a punch is excluded
        until it's fixed on the Timesheet tab.
      </p>
    </div>
  );
}

/* ---------- aggregation ---------- */

type Bucket = { label: string; tick: string; minutes: number };

function computeStats(sessions: Session[], from: string, to: string) {
  let totalMinutes = 0;
  let completedCount = 0;
  let openCount = 0;
  let missingInCount = 0;

  const byStudent = new Map<string, { name: string; shape: string; color: string; minutes: number }>();
  const byDay = new Map<string, number>();

  for (const s of sessions) {
    const mins = sessionMinutes(s.clockIn, s.clockOut);
    if (s.clockIn && !s.clockOut) openCount += 1;
    if (!s.clockIn && s.clockOut) missingInCount += 1;
    if (mins === null) continue;
    completedCount += 1;
    totalMinutes += mins;

    const st = byStudent.get(s.studentName) ?? {
      name: s.studentName,
      shape: s.shape,
      color: s.color,
      minutes: 0,
    };
    st.minutes += mins;
    byStudent.set(s.studentName, st);

    byDay.set(toDayString(new Date(s.clockIn!)), (byDay.get(toDayString(new Date(s.clockIn!))) ?? 0) + mins);
  }

  const perStudent = [...byStudent.values()].sort((a, b) => b.minutes - a.minutes);
  const maxStudentMinutes = Math.max(1, ...perStudent.map((s) => s.minutes));

  // Daily buckets across the whole range; fold into weeks for long ranges.
  const days: string[] = [];
  for (
    let d = new Date(`${from}T12:00:00`);
    toDayString(d) <= to && days.length < 400;
    d.setDate(d.getDate() + 1)
  ) {
    days.push(toDayString(d));
  }
  const weekly = days.length > 35;

  let buckets: Bucket[];
  if (weekly) {
    const weeks = new Map<string, Bucket>();
    for (const day of days) {
      const mon = mondayOf(new Date(`${day}T12:00:00`));
      const key = toDayString(mon);
      const b =
        weeks.get(key) ??
        {
          label: `Week of ${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          tick: mon.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
          minutes: 0,
        };
      b.minutes += byDay.get(day) ?? 0;
      weeks.set(key, b);
    }
    buckets = [...weeks.values()];
  } else {
    buckets = days.map((day) => {
      const d = new Date(`${day}T12:00:00`);
      return {
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        tick: d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        minutes: byDay.get(day) ?? 0,
      };
    });
  }

  return {
    totalMinutes,
    completedCount,
    openCount,
    missingInCount,
    perStudent,
    maxStudentMinutes,
    buckets,
    weekly,
  };
}

/* ---------- components ---------- */

function StatTile({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="text-xs font-bold text-rtc-gray">{label}</div>
      <div className={`text-3xl font-black mt-1 ${alert ? 'text-amber-600' : 'text-rtc-ink'}`}>
        {alert && '⚠ '}
        {value}
      </div>
      {sub && <div className="text-xs font-bold text-rtc-gray mt-1">{sub}</div>}
    </div>
  );
}

/** Column with only the data end (top) rounded, flat at the baseline. */
function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function niceCeilHours(hours: number): number {
  if (hours <= 1) return 1;
  const steps = [1, 2, 4, 5, 10, 20, 25, 50, 100, 200];
  for (const s of steps) if (hours <= s) return s;
  return Math.ceil(hours / 100) * 100;
}

function BucketChart({ buckets }: { buckets: Bucket[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = 230;
  const pad = { left: 40, right: 8, top: 16, bottom: 26 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const yMaxHours = niceCeilHours(Math.max(...buckets.map((b) => b.minutes)) / 60);
  const yTicks = [0, yMaxHours / 2, yMaxHours];
  const slot = plotW / buckets.length;
  const barW = Math.min(44, Math.max(6, slot - 6));
  const labelEvery = Math.ceil(buckets.length / 10);

  const y = (minutes: number) => pad.top + plotH - (minutes / 60 / yMaxHours) * plotH;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Hours worked over time">
        {/* gridlines + y axis labels (hours) */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y(t * 60)}
              y2={y(t * 60)}
              stroke="#e1e0d9"
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={y(t * 60) + 3.5}
              textAnchor="end"
              fontSize={11}
              fontWeight={700}
              fill="#898781"
            >
              {t}h
            </text>
          </g>
        ))}
        {/* baseline */}
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={pad.top + plotH}
          y2={pad.top + plotH}
          stroke="#c3c2b7"
          strokeWidth={1}
        />

        {buckets.map((b, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const barH = pad.top + plotH - y(b.minutes);
          return (
            <g key={i}>
              {b.minutes > 0 && (
                <path
                  d={topRoundedRect(x, y(b.minutes), barW, barH, 4)}
                  fill="var(--color-rtc-green)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {i % labelEvery === 0 && (
                <text
                  x={pad.left + i * slot + slot / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#898781"
                >
                  {b.tick}
                </text>
              )}
              {/* hover hit target: full column height */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>

      {hover !== null && (
        <div
          className="absolute pointer-events-none bg-rtc-ink text-white text-xs font-bold rounded-lg px-3 py-1.5 -translate-x-1/2 whitespace-nowrap"
          style={{
            left: `${((pad.left + hover * slot + slot / 2) / W) * 100}%`,
            top: 0,
          }}
        >
          {buckets[hover].label} — {buckets[hover].minutes > 0 ? fmtDuration(buckets[hover].minutes) : 'no hours'}
        </div>
      )}
    </div>
  );
}
