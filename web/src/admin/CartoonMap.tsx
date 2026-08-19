import { useEffect, useMemo, useRef, useState } from 'react';
import { api, bLabel, rLabel, type Campus, type Day, type Group, type Signup } from '../lib/api';
import {
  BUILDINGS as LAYOUTS,
  FOUNTAIN,
  HOME,
  MAP_H,
  MAP_W,
  QUAD,
  SIDEWALKS,
  TREES,
  center,
  layoutTiles,
  offsetRight,
  perimeterLoop,
  pointAlong,
  roomRect,
  routeAlongSidewalks,
  type BuildingLayout,
  type Pt,
  type Rect,
} from '../lib/campusLayout';

// Group A is crimson, not green: a green route disappears against the grass.
const GROUP_COLOR: Record<Group, string> = { A: '#C2255C', B: '#1976D2' };
const GROUP_LABEL: Record<Group, string> = { A: 'Group A · slow walkers', B: 'Group B · standard route' };

type View = Day | 'week';

type Rename = { key: string; title: string; base: string; current: string; at: Pt };

/* ---------- colour helpers ---------- */

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/* ---------- text fitting ---------- */

function fitText(label: string, w: number, h: number): { lines: string[]; size: number } {
  const avail = w - 8;
  const one = Math.min(h * 0.5, 16, (avail * 1.85) / Math.max(1, label.length));
  if (one >= 9.5 || !label.includes(' ')) return { lines: [label], size: Math.max(7, one) };
  // split into two lines at the space nearest the middle
  const words = label.split(' ');
  let best = 0, bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length, b = words.slice(i).join(' ').length;
    const diff = Math.abs(a - b);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  const lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  const longest = Math.max(...lines.map((l) => l.length));
  const two = Math.min(h * 0.36, 14, (avail * 1.85) / longest);
  return { lines, size: Math.max(7, two) };
}

function TileText({ label, rect, fill = '#1A2733', weight = 700 }: { label: string; rect: Rect; fill?: string; weight?: number }) {
  const { lines, size } = fitText(label, rect.w, rect.h);
  const c = center(rect);
  const lh = size * 1.1;
  const y0 = c.y - ((lines.length - 1) * lh) / 2;
  return (
    <text textAnchor="middle" fontSize={size} fontWeight={weight} fill={fill} style={{ pointerEvents: 'none' }}>
      {lines.map((l, i) => (
        <tspan key={i} x={c.x} y={y0 + i * lh + size * 0.36}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/* ---------- main component ---------- */

export function CartoonMap({
  campus,
  signups,
  view,
  onViewChange,
  selected,
  onSelect,
  onLabelsChange,
}: {
  campus: Campus;
  signups: Signup[];
  view: View;
  onViewChange: (v: View) => void;
  selected: string | null;
  onSelect: (key: string | null) => void;
  onLabelsChange: (labels: Record<string, string>) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [personHover, setPersonHover] = useState<Signup | null>(null);
  const [rename, setRename] = useState<Rename | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const layoutByKey = useMemo(() => new Map(LAYOUTS.map((l) => [l.key, l])), []);
  const infoByKey = useMemo(() => new Map(campus.buildings.map((b) => [b.key, b])), [campus]);

  const active = useMemo(() => {
    const m = new Map<string, Group>();
    for (const b of campus.buildings) if (view === 'week' || b.day === view) m.set(b.key, b.group);
    return m;
  }, [campus, view]);

  const routes = useMemo(() => {
    if (view === 'week') return [];
    const out: Array<{ group: Group; pts: Pt[]; lap?: boolean }> = [];
    for (const g of ['A', 'B'] as Group[]) {
      const todays = campus.buildings.filter((b) => b.day === view && b.group === g);
      const stops = todays.map((b) => layoutByKey.get(b.key)?.entrance).filter((p): p is Pt => !!p);
      if (!stops.length) continue;

      // Collecting the building we already live in: walk a lap around it,
      // otherwise the route is a stub hidden under the classrooms.
      if (todays.length === 1 && todays[0].key === HOME.building) {
        const home = layoutByKey.get(HOME.building);
        if (home) {
          const room = roomRect(home, HOME.room);
          const start = room ? center(room) : HOME.path[0];
          out.push({ group: g, pts: perimeterLoop(home.rect, start), lap: true });
          continue;
        }
      }

      let pts: Pt[] = [...HOME.path];
      let cur = HOME.door;
      for (const s of [...stops, HOME.door]) {
        const leg = routeAlongSidewalks(cur, s);
        pts = pts.concat(leg.slice(1));
        cur = s;
      }
      pts = pts.concat([...HOME.path].reverse().slice(1));
      // Lanes: A hugs the centre, B walks the outer lane; out/back on opposite sides.
      out.push({ group: g, pts: offsetRight(pts, g === 'A' ? 6 : 15) });
    }
    return out;
  }, [campus, view, layoutByKey]);

  // People placed on the map: [signup, point]
  const people = useMemo(() => {
    const out: Array<{ s: Signup; p: Pt }> = [];
    const perTile = new Map<string, number>();
    for (const s of signups) {
      const l = layoutByKey.get(s.building);
      if (!l) continue;
      const rr = s.isCustom ? null : roomRect(l, s.room);
      const tileKey = rr ? `${s.building}|${s.room}` : `${s.building}|*`;
      const n = perTile.get(tileKey) ?? 0;
      perTile.set(tileKey, n + 1);
      const base = rr ? { x: rr.x + rr.w - 12, y: rr.y + rr.h - 12 } : { x: l.rect.x + l.rect.w - 18, y: l.rect.y + l.rect.h - 14 };
      out.push({ s, p: { x: base.x - 6 - n * 26, y: base.y - 4 } });
    }
    return out;
  }, [signups, layoutByKey]);

  const roomsWithBins = useMemo(() => new Set(signups.filter((s) => !s.isCustom).map((s) => `${s.building}|${s.room}`)), [signups]);
  const countByBuilding = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of signups) m.set(s.building, (m.get(s.building) ?? 0) + 1);
    return m;
  }, [signups]);

  const focus = hover ?? selected;
  const focusInfo = focus ? infoByKey.get(focus) : null;

  useEffect(() => {
    if (!rename) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setRename(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rename]);

  function svgPointToPercent(p: Pt): { left: string; top: string } {
    return { left: `${(p.x / MAP_W) * 100}%`, top: `${(p.y / MAP_H) * 100}%` };
  }

  function openRename(key: string, title: string, base: string, at: Pt) {
    setRename({ key, title, base, current: campus.labels[key] ?? base, at });
  }

  async function saveRename(value: string) {
    if (!rename) return;
    const v = value.trim();
    const { labels } = await api.setLabel(rename.key, v === rename.base ? '' : v);
    onLabelsChange(labels);
    setRename(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Day tabs + legend */}
      <div className="flex flex-wrap items-center gap-1.5">
        {campus.days.map((d) => (
          <button key={d} type="button" onClick={() => onViewChange(d)} className={`text-sm font-bold rounded-xl px-4 py-2 border-2 ${view === d ? 'bg-rtc-ink border-rtc-ink text-white' : 'bg-white border-slate-200 text-rtc-gray'}`}>
            {d}
          </button>
        ))}
        <button type="button" onClick={() => onViewChange('week')} className={`text-sm font-bold rounded-xl px-4 py-2 border-2 ${view === 'week' ? 'bg-rtc-ink border-rtc-ink text-white' : 'bg-white border-slate-200 text-rtc-gray'}`}>
          Whole week
        </button>
        <div className="ml-auto flex items-center gap-4 text-xs font-bold text-rtc-gray">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: GROUP_COLOR.A }} /> Group A</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: GROUP_COLOR.B }} /> Group B</span>
          <span>🏳️ Home (DA4)</span>
        </div>
      </div>

      <div ref={wrapRef} className="relative rounded-3xl overflow-hidden border-4 border-white shadow-md" style={{ background: '#8FCB6B' }}>
        <svg ref={svgRef} viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-auto block select-none" role="img" aria-label="Illustrated campus map with pickup routes">
          <defs>
            <pattern id="grass" width="46" height="46" patternUnits="userSpaceOnUse">
              <rect width="46" height="46" fill="#8FCB6B" />
              <circle cx="10" cy="12" r="3" fill="#9BD478" />
              <circle cx="32" cy="30" r="4" fill="#84C262" />
              <circle cx="24" cy="6" r="2" fill="#9BD478" />
              <path d="M6 36 q3 -6 6 0" stroke="#7DBB5B" strokeWidth="2" fill="none" />
              <path d="M36 12 q3 -6 6 0" stroke="#7DBB5B" strokeWidth="2" fill="none" />
            </pattern>
            <pattern id="stripes" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="14" fill="rgba(255,255,255,0.35)" />
            </pattern>
            <filter id="soft" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#2f5a1f" floodOpacity="0.28" />
            </filter>
            <style>{`
              @keyframes rtc-walk { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
              @keyframes rtc-dots { to { stroke-dashoffset: -28; } }
              .rtc-route { animation: rtc-dots 1.6s linear infinite; }
              .rtc-walker { animation: rtc-walk 0.7s ease-in-out infinite; }
              @media (prefers-reduced-motion: reduce) { .rtc-route, .rtc-walker { animation: none; } }
            `}</style>
          </defs>

          {/* Ground */}
          <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#grass)" />

          {/* Quad lawn */}
          <rect x={QUAD.x} y={QUAD.y} width={QUAD.w} height={QUAD.h} rx={40} fill="#7DBE5A" />
          <rect x={QUAD.x + 14} y={QUAD.y + 14} width={QUAD.w - 28} height={QUAD.h - 28} rx={30} fill="none" stroke="#9BD478" strokeWidth={4} strokeDasharray="10 12" />
          <text x={QUAD.x + QUAD.w / 2} y={QUAD.y + QUAD.h - 24} textAnchor="middle" fontSize={20} fontWeight={800} fill="#4E8A34">Quad</text>
          {/* Fountain */}
          <circle cx={FOUNTAIN.x} cy={FOUNTAIN.y} r={30} fill="#7FB8E5" stroke="#E7EEF3" strokeWidth={6} />
          <circle cx={FOUNTAIN.x} cy={FOUNTAIN.y} r={12} fill="#BFE0F7" />
          <circle cx={FOUNTAIN.x} cy={FOUNTAIN.y} r={4} fill="#FFFFFF" />

          {/* Sidewalks */}
          {SIDEWALKS.map((s, i) => (
            <line key={`o${i}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="#CDB98A" strokeWidth={46} strokeLinecap="round" />
          ))}
          {SIDEWALKS.map((s, i) => (
            <line key={`i${i}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="#EBDDB6" strokeWidth={38} strokeLinecap="round" />
          ))}

          {/* Buildings */}
          {LAYOUTS.map((l) => {
            const info = infoByKey.get(l.key);
            const grp = active.get(l.key);
            const dim = view !== 'week' && !grp;
            const isFocus = focus === l.key;
            const outline = grp ? GROUP_COLOR[grp] : isFocus ? '#1A2733' : undefined;
            const name = bLabel(campus, l.key);
            const footprints: Array<{ rect: Rect; rows?: BuildingLayout['rows']; main: boolean }> = [
              { rect: l.rect, rows: l.rows, main: true },
              ...(l.annex ?? []).map((a) => ({ rect: a.rect, rows: a.rows, main: false })),
            ];
            return (
              <g
                key={l.key}
                opacity={dim ? 0.55 : 1}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover(l.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(selected === l.key ? null : l.key)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  openRename(`b:${l.key}`, 'Rename building', info?.name ?? l.key, { x: l.rect.x + l.rect.w / 2, y: l.rect.y });
                }}
              >
                {footprints.map(({ rect, rows, main }, fi) => {
                  const wall = shade(l.color, -0.16);
                  const tiles = rows ? layoutTiles(rect, rows) : [];
                  return (
                    <g key={fi}>
                      {/* shadow + walls + roof */}
                      <rect x={rect.x + 6} y={rect.y + 10} width={rect.w} height={rect.h} rx={18} fill="#2f5a1f" opacity={0.22} />
                      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={18} fill={wall} />
                      <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h - 8} rx={18} fill={l.color} />
                      {l.style === 'gym' && main && (
                        <rect x={rect.x + 10} y={rect.y + 10} width={rect.w - 20} height={rect.h - 28} rx={12} fill="url(#stripes)" />
                      )}
                      {l.approx && (
                        <rect x={rect.x - 5} y={rect.y - 5} width={rect.w + 10} height={rect.h + 10} rx={22} fill="none" stroke="#1A2733" strokeWidth={2} strokeDasharray="8 8" opacity={0.5} />
                      )}
                      {/* group outline */}
                      {outline && (
                        <rect x={rect.x - 4} y={rect.y - 4} width={rect.w + 8} height={rect.h + 8} rx={22} fill="none" stroke={outline} strokeWidth={isFocus ? 8 : 5} opacity={0.95} />
                      )}
                      {/* tiles */}
                      {tiles.map((tile, ti) => {
                        if ('corridor' in tile) {
                          const r = tile.rect;
                          return (
                            <g key={ti}>
                              <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} fill={shade(l.color, -0.08)} />
                              {main && <TileText label={name} rect={r} fill={shade(l.color, -0.45)} weight={800} />}
                            </g>
                          );
                        }
                        const r = tile.rect;
                        const isHome = l.key === HOME.building && tile.room === HOME.room;
                        const hasBin = roomsWithBins.has(`${l.key}|${tile.room}`);
                        const label = rLabel(campus, l.key, tile.room);
                        return (
                          <g
                            key={ti}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              openRename(`r:${l.key}|${tile.room}`, 'Rename room', tile.room, { x: r.x + r.w / 2, y: r.y });
                            }}
                          >
                            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={7} fill={isHome ? '#FFE27A' : shade(l.color, 0.22)} stroke={isHome ? '#E0A800' : shade(l.color, -0.1)} strokeWidth={isHome ? 3 : 1.5} />
                            <TileText label={label} rect={r} />
                            {hasBin && <BinIcon x={r.x + 4} y={r.y + 4} />}
                          </g>
                        );
                      })}
                      {/* name pill for buildings without a corridor row */}
                      {main && !l.rows.includes('corridor') && (
                        <g>
                          <rect x={rect.x + 8} y={rect.y - 14} width={Math.min(rect.w - 16, name.length * 9 + 22)} height={24} rx={12} fill="#FFFFFF" stroke={shade(l.color, -0.3)} strokeWidth={2} />
                          <text x={rect.x + 19} y={rect.y + 3} fontSize={14} fontWeight={800} fill="#1A2733">{name.length * 9 + 22 > rect.w - 16 ? name.slice(0, Math.floor((rect.w - 40) / 9)) + '…' : name}</text>
                        </g>
                      )}
                    </g>
                  );
                })}
                {/* week-view day tag + count badge */}
                {(() => {
                  const c = center(l.rect);
                  const n = countByBuilding.get(l.key) ?? 0;
                  const g = info?.group;
                  if (view !== 'week' && !grp && n === 0) return null;
                  return (
                    <g pointerEvents="none">
                      {view === 'week' && info && (
                        <g>
                          <rect x={l.rect.x + l.rect.w - 62} y={l.rect.y - 12} width={54} height={24} rx={12} fill={GROUP_COLOR[info.group]} stroke="white" strokeWidth={3} />
                          <text x={l.rect.x + l.rect.w - 35} y={l.rect.y + 5} textAnchor="middle" fontSize={13} fontWeight={900} fill="white">{info.day.slice(0, 3)}</text>
                        </g>
                      )}
                      {n > 0 && g && (
                        <g>
                          <circle cx={l.rect.x + l.rect.w - 4} cy={l.rect.y + l.rect.h - 4} r={20} fill={GROUP_COLOR[g]} stroke="white" strokeWidth={4} />
                          <text x={l.rect.x + l.rect.w - 4} y={l.rect.y + l.rect.h + 3} textAnchor="middle" fontSize={20} fontWeight={900} fill="white">{n}</text>
                          <title>{`${n} sign-up${n === 1 ? '' : 's'}`}</title>
                        </g>
                      )}
                      {c && null}
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {/* Doorways */}
          {LAYOUTS.map((l) => (
            <circle key={`door-${l.key}`} cx={l.entrance.x} cy={l.entrance.y} r={7} fill="#B89A63" stroke="#EBDDB6" strokeWidth={2} pointerEvents="none" />
          ))}

          {/* Trees */}
          {TREES.map((tr, i) => (
            <Tree key={i} x={tr.x} y={tr.y} r={tr.r ?? 22} />
          ))}

          {/* Routes */}
          {routes.map((r) => {
            const d = r.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
            const walker = pointAlong(r.pts, r.lap ? 0.62 : r.group === 'A' ? 0.3 : 0.25);
            return (
              <g key={r.group} pointerEvents="none">
                <path d={d} fill="none" stroke="white" strokeWidth={11} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
                <path d={d} fill="none" stroke={GROUP_COLOR[r.group]} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="1 13" className="rtc-route" />
                <Walkers x={walker.x} y={walker.y} color={GROUP_COLOR[r.group]} label={r.group} />
              </g>
            );
          })}

          {/* Home flag */}
          {(() => {
            const l = layoutByKey.get(HOME.building);
            const r = l ? roomRect(l, HOME.room) : null;
            if (!r) return null;
            const fx = r.x + 10, fy = r.y - 40;
            return (
              <g pointerEvents="none">
                <line x1={fx} y1={fy} x2={fx} y2={r.y + 8} stroke="#5D4037" strokeWidth={4} strokeLinecap="round" />
                <path d={`M${fx},${fy} l40,12 l-40,12 z`} fill="#E53935" stroke="white" strokeWidth={2} />
                <text x={fx + 9} y={fy + 17} fontSize={14} fontWeight={900} fill="white">★</text>
                <rect x={fx + 44} y={fy - 2} width={54} height={22} rx={11} fill="#FFE27A" stroke="#E0A800" strokeWidth={2} />
                <text x={fx + 71} y={fy + 14} textAnchor="middle" fontSize={12} fontWeight={900} fill="#5D4037">HOME</text>
              </g>
            );
          })()}

          {/* People */}
          {people.map(({ s, p }) => (
            <Person key={s.id} x={p.x} y={p.y} name={s.name} color={s.group ? GROUP_COLOR[s.group] : '#6B7A87'} onEnter={() => setPersonHover(s)} onLeave={() => setPersonHover(null)} />
          ))}
        </svg>

        {/* Building card */}
        {focusInfo && !rename && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-2xl shadow-lg border-2 border-slate-200 p-3 max-w-xs text-sm">
            <div className="flex items-start gap-2">
              <div className="min-w-0">
                <div className="font-black text-rtc-ink leading-tight">{bLabel(campus, focusInfo)}</div>
                <div className="text-xs font-bold mt-0.5" style={{ color: GROUP_COLOR[focusInfo.group] }}>
                  {focusInfo.day}s · {GROUP_LABEL[focusInfo.group]}
                </div>
              </div>
              {selected === focusInfo.key && (
                <button type="button" onClick={() => onSelect(null)} className="ml-auto text-rtc-gray font-bold px-1" aria-label="Close">✕</button>
              )}
            </div>
            {(() => {
              const list = signups.filter((s) => s.building === focusInfo.key);
              return list.length === 0 ? (
                <div className="text-xs text-rtc-gray font-bold mt-2">No sign-ups here yet.</div>
              ) : (
                <ul className="mt-2 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                  {list.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3">
                      <span className="font-bold truncate">{s.roomLabel}</span>
                      <span className="text-rtc-gray truncate">{s.name}</span>
                    </li>
                  ))}
                </ul>
              );
            })()}
            <div className="text-[10px] text-rtc-gray mt-2">{selected === focusInfo.key ? 'Double-click to rename' : 'Click to pin · double-click to rename'}</div>
          </div>
        )}

        {/* Person tooltip */}
        {personHover && !rename && (
          <div className="absolute bottom-3 left-3 bg-rtc-ink text-white rounded-xl shadow-lg px-3 py-2 text-xs font-bold pointer-events-none">
            {personHover.name} · {personHover.roomLabel}{personHover.roomDetail ? ` — ${personHover.roomDetail}` : ''}
          </div>
        )}

        {/* Rename popover */}
        {rename && (
          <RenamePopover rename={rename} style={svgPointToPercent(rename.at)} onSave={saveRename} onCancel={() => setRename(null)} />
        )}
      </div>

      <p className="text-xs text-rtc-gray font-bold">
        Tip: double-click any building or room to rename it — the new name shows up on the sign-up form and schedule too. Routes follow the sidewalks from DA4 and back.
      </p>
    </div>
  );
}

/* ---------- little drawings ---------- */

function Tree({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={x + 4} cy={y + r * 0.9} rx={r * 0.9} ry={r * 0.35} fill="#2f5a1f" opacity={0.2} />
      <circle cx={x} cy={y} r={r} fill="#4E9A3E" />
      <circle cx={x - r * 0.35} cy={y - r * 0.3} r={r * 0.55} fill="#63B24E" />
      <circle cx={x + r * 0.3} cy={y - r * 0.15} r={r * 0.4} fill="#7CC768" />
    </g>
  );
}

function BinIcon({ x, y }: { x: number; y: number }) {
  return (
    <g pointerEvents="none">
      <rect x={x} y={y + 3} width={13} height={14} rx={3} fill="#2E7D32" stroke="white" strokeWidth={1.5} />
      <rect x={x - 1.5} y={y} width={16} height={4} rx={2} fill="#1B5E20" stroke="white" strokeWidth={1.2} />
      <text x={x + 6.5} y={y + 14} textAnchor="middle" fontSize={9} fill="white" fontWeight={900}>♻</text>
    </g>
  );
}

function Person({ x, y, name, color, onEnter, onLeave }: { x: number; y: number; name: string; color: string; onEnter: () => void; onLeave: () => void }) {
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <g style={{ cursor: 'default' }} onMouseEnter={onEnter} onMouseLeave={onLeave} transform={`translate(${x} ${y}) scale(1.6) translate(${-x} ${-y})`}>
      <ellipse cx={x} cy={y + 12} rx={9} ry={3} fill="#000" opacity={0.15} />
      <rect x={x - 9} y={y - 2} width={18} height={14} rx={7} fill={color} stroke="white" strokeWidth={2} />
      <circle cx={x} cy={y - 8} r={9} fill="#FFDDB8" stroke="white" strokeWidth={2} />
      <path d={`M${x - 9},${y - 9} a9,9 0 0 1 18,0 z`} fill={color} />
      <text x={x} y={y + 8.5} textAnchor="middle" fontSize={8} fontWeight={900} fill="white">{initials}</text>
    </g>
  );
}

function Walkers({ x, y, color, label }: { x: number; y: number; color: string; label: string }) {
  return (
    <g className="rtc-walker" style={{ transformOrigin: `${x}px ${y}px` }}>
      <g transform={`translate(${x} ${y}) scale(1.8) translate(${-x} ${-y})`}>
      <ellipse cx={x} cy={y + 14} rx={26} ry={5} fill="#000" opacity={0.15} />
      {/* bin */}
      <rect x={x - 8} y={y - 4} width={16} height={16} rx={3} fill="#2E7D32" stroke="white" strokeWidth={2} />
      <text x={x} y={y + 8} textAnchor="middle" fontSize={11} fontWeight={900} fill="white">♻</text>
      {/* two students */}
      <circle cx={x - 20} cy={y - 8} r={9} fill="#FFDDB8" stroke="white" strokeWidth={2} />
      <path d={`M${x - 29},${y - 9} a9,9 0 0 1 18,0 z`} fill={color} />
      <rect x={x - 28} y={y - 1} width={16} height={12} rx={6} fill={color} stroke="white" strokeWidth={2} />
      <circle cx={x + 20} cy={y - 8} r={9} fill="#E8B58A" stroke="white" strokeWidth={2} />
      <path d={`M${x + 11},${y - 9} a9,9 0 0 1 18,0 z`} fill={color} />
      <rect x={x + 12} y={y - 1} width={16} height={12} rx={6} fill={color} stroke="white" strokeWidth={2} />
      {/* group tag */}
      <rect x={x - 12} y={y - 34} width={24} height={18} rx={9} fill="white" stroke={color} strokeWidth={2} />
      <text x={x} y={y - 21} textAnchor="middle" fontSize={11} fontWeight={900} fill={color}>{label}</text>
      </g>
    </g>
  );
}

function RenamePopover({ rename, style, onSave, onCancel }: { rename: Rename; style: { left: string; top: string }; onSave: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(rename.current);
  const [busy, setBusy] = useState(false);
  const overridden = rename.current !== rename.base;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave(value);
      }}
      className="absolute -translate-x-1/2 -translate-y-full bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-3 w-64 flex flex-col gap-2 z-10"
      style={{ ...style, marginTop: -8 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-black text-rtc-gray">{rename.title}</div>
      <input autoFocus type="text" value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} className="border-2 border-blue-300 rounded-lg px-2 py-1.5 font-bold text-sm" onFocus={(e) => e.target.select()} />
      {overridden && <div className="text-[11px] text-rtc-gray">Original: <b>{rename.base}</b></div>}
      <div className="flex gap-2 justify-end">
        {overridden && (
          <button type="button" onClick={() => onSave('')} className="text-xs font-bold text-rtc-gray mr-auto underline">Reset</button>
        )}
        <button type="button" onClick={onCancel} className="text-xs font-bold text-rtc-gray px-2 py-1">Cancel</button>
        <button type="submit" disabled={busy || !value.trim()} className="text-xs font-bold bg-rtc-green text-white rounded-lg px-3 py-1 disabled:opacity-50">Save</button>
      </div>
    </form>
  );
}
