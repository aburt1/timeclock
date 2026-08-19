import { useMemo, useState } from 'react';
import type { Building, Campus, Day, Group, Signup } from '../lib/api';
import { BUILDING_RECTS, HOME_POINT, MAP_H, MAP_W, buildingCenter } from '../lib/campusMap';

const GROUP_COLOR: Record<Group, string> = { A: '#2E7D32', B: '#1976D2' };
const GROUP_LABEL: Record<Group, string> = { A: 'Group A · slow walkers', B: 'Group B · standard route' };

type View = Day | 'week';

export function CampusMap({
  campus,
  signups,
  view,
  onViewChange,
  selected,
  onSelect,
}: {
  campus: Campus;
  signups: Signup[];
  view: View;
  onViewChange: (v: View) => void;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);

  // Sign-ups per building (using the effective day/group so overrides show).
  const countByBuilding = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of signups) m.set(s.building, (m.get(s.building) ?? 0) + 1);
    return m;
  }, [signups]);

  // Which buildings are "on" for the current view, and in what group.
  const active = useMemo(() => {
    const m = new Map<string, Group>();
    for (const b of campus.buildings) {
      if (view === 'week' || b.day === view) m.set(b.key, b.group);
    }
    return m;
  }, [campus, view]);

  // Route waypoints for a single day: home → buildings → home, per group.
  const routes = useMemo(() => {
    if (view === 'week') return [];
    const out: Array<{ group: Group; points: Array<{ x: number; y: number }> }> = [];
    for (const g of ['A', 'B'] as Group[]) {
      const stops = campus.buildings
        .filter((b) => b.day === view && b.group === g)
        .map((b) => buildingCenter(b.key))
        .filter((p): p is { x: number; y: number } => !!p);
      if (stops.length) out.push({ group: g, points: [HOME_POINT, ...stops, HOME_POINT] });
    }
    return out;
  }, [campus, view]);

  const focus = hover ?? selected;
  const focusBuilding = focus ? campus.buildings.find((b) => b.key === focus) : null;
  const notOnMap = campus.buildings.filter((b) => !BUILDING_RECTS[b.key]);

  return (
    <div className="flex flex-col gap-3">
      {/* Day tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {campus.days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onViewChange(d)}
            className={`text-sm font-bold rounded-xl px-4 py-2 border-2 ${
              view === d ? 'bg-rtc-ink border-rtc-ink text-white' : 'bg-white border-slate-200 text-rtc-gray'
            }`}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onViewChange('week')}
          className={`text-sm font-bold rounded-xl px-4 py-2 border-2 ${
            view === 'week' ? 'bg-rtc-ink border-rtc-ink text-white' : 'bg-white border-slate-200 text-rtc-gray'
          }`}
        >
          Whole week
        </button>
        <div className="ml-auto flex items-center gap-4 text-xs font-bold text-rtc-gray">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: GROUP_COLOR.A }} /> Group A
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: GROUP_COLOR.B }} /> Group B
          </span>
          <span>★ Home (DA4)</span>
        </div>
      </div>

      {/* Map */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-white">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="w-full h-auto block"
          role="img"
          aria-label="Campus map with pickup routes"
        >
          <image href="/campus-map.png" x={0} y={0} width={MAP_W} height={MAP_H} />

          {/* Dim everything slightly on day views so the active buildings pop */}
          {view !== 'week' && <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="white" opacity={0.35} />}

          {/* Building overlays */}
          {campus.buildings.map((b) => {
            const rects = BUILDING_RECTS[b.key];
            if (!rects) return null;
            const grp = active.get(b.key);
            const isFocus = focus === b.key;
            const color = GROUP_COLOR[b.group];
            return (
              <g
                key={b.key}
                onMouseEnter={() => setHover(b.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(selected === b.key ? null : b.key)}
                style={{ cursor: 'pointer' }}
              >
                {rects.map((r, i) => (
                  <rect
                    key={i}
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    rx={8}
                    fill={grp ? color : '#94a3b8'}
                    fillOpacity={grp ? (isFocus ? 0.45 : 0.28) : isFocus ? 0.25 : 0.06}
                    stroke={grp || isFocus ? color : 'transparent'}
                    strokeWidth={isFocus ? 6 : grp ? 4 : 0}
                    strokeOpacity={grp || isFocus ? 1 : 0}
                  />
                ))}
              </g>
            );
          })}

          {/* Routes */}
          {routes.map((r) => (
            <g key={r.group}>
              <polyline
                points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="white"
                strokeWidth={12}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.9}
              />
              <polyline
                points={r.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={GROUP_COLOR[r.group]}
                strokeWidth={6}
                strokeDasharray={r.group === 'B' ? '18 12' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* Building labels + sign-up counts */}
          {campus.buildings.map((b) => {
            const c = buildingCenter(b.key);
            if (!c) return null;
            const n = countByBuilding.get(b.key) ?? 0;
            const grp = active.get(b.key);
            if (!grp && n === 0) return null;
            return (
              <g key={b.key} pointerEvents="none">
                {view === 'week' && (
                  <text
                    x={c.x}
                    y={c.y - 22}
                    textAnchor="middle"
                    fontSize={22}
                    fontWeight={800}
                    fill={GROUP_COLOR[b.group]}
                    stroke="white"
                    strokeWidth={5}
                    paintOrder="stroke"
                  >
                    {b.day.slice(0, 3)}
                  </text>
                )}
                <circle
                  cx={c.x}
                  cy={c.y + (view === 'week' ? 6 : 0)}
                  r={n > 0 ? 24 : 12}
                  fill={n > 0 ? GROUP_COLOR[b.group] : 'white'}
                  stroke="white"
                  strokeWidth={4}
                  opacity={grp || n > 0 ? 1 : 0.5}
                />
                {n > 0 && (
                  <text
                    x={c.x}
                    y={c.y + (view === 'week' ? 6 : 0) + 8}
                    textAnchor="middle"
                    fontSize={24}
                    fontWeight={900}
                    fill="white"
                  >
                    {n}
                  </text>
                )}
              </g>
            );
          })}

          {/* Home marker */}
          <g pointerEvents="none">
            <circle cx={HOME_POINT.x} cy={HOME_POINT.y} r={26} fill="#FBC02D" stroke="white" strokeWidth={5} />
            <text
              x={HOME_POINT.x}
              y={HOME_POINT.y + 10}
              textAnchor="middle"
              fontSize={30}
              fontWeight={900}
              fill="#1A2733"
            >
              ★
            </text>
          </g>
        </svg>

        {/* Hover / selection card */}
        {focusBuilding && (
          <BuildingCard
            building={focusBuilding}
            signups={signups.filter((s) => s.building === focusBuilding.key)}
            pinned={selected === focusBuilding.key}
            onClose={() => onSelect(null)}
          />
        )}
      </div>

      {notOnMap.length > 0 && (
        <p className="text-xs text-rtc-gray font-bold">
          Not drawn on the map: {notOnMap.map((b) => b.name).join(', ')} — still scheduled normally.
        </p>
      )}
    </div>
  );
}

function BuildingCard({
  building,
  signups,
  pinned,
  onClose,
}: {
  building: Building;
  signups: Signup[];
  pinned: boolean;
  onClose: () => void;
}) {
  return (
    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-2xl shadow-lg border-2 border-slate-200 p-3 max-w-xs text-sm pointer-events-auto">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <div className="font-black text-rtc-ink leading-tight">{building.name}</div>
          <div className="text-xs font-bold mt-0.5" style={{ color: GROUP_COLOR[building.group] }}>
            {building.day}s · {GROUP_LABEL[building.group]}
          </div>
        </div>
        {pinned && (
          <button type="button" onClick={onClose} className="ml-auto text-rtc-gray font-bold px-1" aria-label="Close">
            ✕
          </button>
        )}
      </div>
      {signups.length === 0 ? (
        <div className="text-xs text-rtc-gray font-bold mt-2">No sign-ups here yet.</div>
      ) : (
        <ul className="mt-2 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
          {signups.map((s) => (
            <li key={s.id} className="flex justify-between gap-3">
              <span className="font-bold truncate">{s.room}</span>
              <span className="text-rtc-gray truncate">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
      {!pinned && <div className="text-[10px] text-rtc-gray mt-2">Click to pin</div>}
    </div>
  );
}
