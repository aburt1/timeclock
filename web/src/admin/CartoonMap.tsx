import { useEffect, useMemo, useRef, useState } from 'react';
import { api, bLabel, rLabel, type Campus, type Day, type Group, type Signup } from '../lib/api';
import {
  BUILDINGS as LAYOUTS,
  HOME,
  LANDMARKS,
  MAP_H,
  MAP_W,
  SIDEWALKS,
  TREES,
  buildingParts,
  center,
  cumulative,
  layoutTiles,
  partSpine,
  pointAtDistance,
  roomDoor,
  roomRect,
  routeAlongSidewalks,
  spineEntry,
  type BuildingLayout,
  type Pt,
  type Rect,
} from '../lib/campusLayout';

/*
 * Shown to the class on the board, so it is built to be read across a room:
 * nothing moves on its own, one group's walk at a time, the path goes down the
 * hallway and into each classroom door, and the slider walks it step by step.
 */

const GROUP_COLOR: Record<Group, string> = { A: '#C2255C', B: '#1565C0' };
const GROUP_NAME: Record<Group, string> = { A: 'Group A', B: 'Group B' };
const GROUP_SUB: Record<Group, string> = { A: 'Slow walkers', B: 'Standard route' };
const HOME_COLOR = '#F9A825';
const QUIET_FILL = '#C3DCB2';
const QUIET_INK = '#63805A';

type View = Day | 'week';
type Rename = { key: string; title: string; base: string; current: string; at: Pt };
type Stop = { signup: Signup; buildingKey: string; label: string; who: string; door: Pt; at: number };

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `#${((ch(n >> 16) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, '0')}`;
}

function fitText(label: string, w: number, h: number, max: number) {
  const avail = w - 10;
  const one = Math.min(h * 0.6, max, (avail * 1.9) / Math.max(1, label.length));
  if (one >= max * 0.6 || !label.includes(' ')) return { lines: [label], size: Math.max(9, one) };
  const words = label.split(' ');
  let cut = 1, bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) { bestDiff = diff; cut = i; }
  }
  const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
  const longest = Math.max(...lines.map((l) => l.length));
  return { lines, size: Math.max(9, Math.min(h * 0.4, max * 0.8, (avail * 1.9) / longest)) };
}

function TileText({ label, rect, fill, max = 22, weight = 800 }: { label: string; rect: Rect; fill: string; max?: number; weight?: number }) {
  const { lines, size } = fitText(label, rect.w, rect.h, max);
  const c = center(rect);
  const lh = size * 1.12;
  const y0 = c.y - ((lines.length - 1) * lh) / 2;
  return (
    <text textAnchor="middle" fontSize={size} fontWeight={weight} fill={fill} style={{ pointerEvents: 'none' }}>
      {lines.map((l, i) => <tspan key={i} x={c.x} y={y0 + i * lh + size * 0.35}>{l}</tspan>)}
    </text>
  );
}

export function CartoonMap({
  campus, signups, view, onViewChange, selected, onSelect, onLabelsChange,
}: {
  campus: Campus;
  signups: Signup[];
  view: View;
  onViewChange: (v: View) => void;
  selected: string | null;
  onSelect: (key: string | null) => void;
  onLabelsChange: (labels: Record<string, string>) => void;
}) {
  const [group, setGroup] = useState<Group>('A');
  const [rename, setRename] = useState<Rename | null>(null);
  const [walked, setWalked] = useState(0);
  const [playing, setPlaying] = useState(false);

  const layoutByKey = useMemo(() => new Map(LAYOUTS.map((l) => [l.key, l])), []);
  const infoByKey = useMemo(() => new Map(campus.buildings.map((b) => [b.key, b])), [campus]);

  /** The walk: out the door, down each hallway, into every classroom with a bin. */
  const plan = useMemo(() => {
    if (view === 'week') return null;
    const todays = campus.buildings.filter((b) => b.day === view && b.group === group);
    const pts: Pt[] = [...HOME.path];
    const stops: Stop[] = [];
    const marks: Array<{ index: number; stop: Omit<Stop, 'at'> }> = [];
    let cur = HOME.door;
    const visited: string[] = [];

    for (const b of todays) {
      const l = layoutByKey.get(b.key);
      if (!l) continue;
      const mine = signups.filter((s) => s.building === b.key);
      if (!mine.length) continue;
      visited.push(b.key);

      pts.push(...routeAlongSidewalks(cur, l.entrance).slice(1));
      cur = l.entrance;

      for (const part of buildingParts(l)) {
        const tiles = layoutTiles(part.rect, part.rows).filter((t) => 'room' in t) as Array<{ room: string; rect: Rect }>;
        const here = mine.filter((s) => !s.isCustom && tiles.some((t) => t.room === s.room));
        if (!here.length) continue;
        const spine = partSpine(part, l.entrance);
        const entry = spineEntry(spine, cur);
        pts.push(entry);
        const doors = here
          .map((s) => ({ s, ...roomDoor(tiles.find((t) => t.room === s.room)!.rect, spine) }))
          .sort((a, z) => Math.hypot(a.hall.x - entry.x, a.hall.y - entry.y) - Math.hypot(z.hall.x - entry.x, z.hall.y - entry.y));
        for (const d of doors) {
          pts.push(d.hall, d.door);
          marks.push({ index: pts.length - 1, stop: { signup: d.s, buildingKey: b.key, label: d.s.roomLabel, who: d.s.name, door: d.door } });
          pts.push(d.hall);
        }
        pts.push(entry);
      }

      pts.push(l.entrance);
      for (const c of mine.filter((s) => s.isCustom)) {
        marks.push({ index: pts.length - 1, stop: { signup: c, buildingKey: b.key, label: c.roomLabel, who: c.name, door: l.entrance } });
      }
      cur = l.entrance;
    }

    if (!visited.length) return { pts: [], stops: [], total: 0, visited };
    pts.push(...routeAlongSidewalks(cur, HOME.door).slice(1));
    pts.push(...[...HOME.path].reverse().slice(1));

    const cum = cumulative(pts);
    for (const m of marks) stops.push({ ...m.stop, at: cum[m.index] });
    return { pts, stops, total: cum[cum.length - 1], visited };
  }, [campus, view, group, signups, layoutByKey]);

  const total = plan?.total ?? 0;

  useEffect(() => { setWalked(0); setPlaying(false); }, [view, group]);

  // The slider can auto-advance, but only while the teacher holds Play.
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!playing || !total) return;
    let last = performance.now();
    const speed = total / 16000; // a full lap in ~16s
    const tick = (now: number) => {
      const next = walkedRef.current + (now - last) * speed;
      last = now;
      if (next >= total) { setWalked(total); setPlaying(false); return; }
      setWalked(next);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, total]);
  const walkedRef = useRef(walked);
  walkedRef.current = walked;

  const litKeys = useMemo(() => {
    if (view === 'week') return null;
    return new Set(plan?.visited ?? []);
  }, [plan, view]);
  const isLit = (key: string) => (litKeys ? litKeys.has(key) : true);

  const doneStops = plan ? plan.stops.filter((s) => s.at <= walked + 1).length : 0;
  const current = plan?.stops[Math.min(doneStops, plan.stops.length - 1)];
  const atStop = plan?.stops.find((s) => Math.abs(s.at - walked) < 12);

  const walker = plan && plan.pts.length ? pointAtDistance(plan.pts, walked) : null;
  const walkedPath = useMemo(() => {
    if (!plan || !plan.pts.length) return '';
    const cum = cumulative(plan.pts);
    const out: Pt[] = [];
    for (let i = 0; i < plan.pts.length; i++) {
      if (cum[i] <= walked) out.push(plan.pts[i]);
      else break;
    }
    if (walker) out.push(walker);
    return out.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  }, [plan, walked, walker]);

  useEffect(() => {
    if (!rename) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setRename(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rename]);

  async function saveRename(value: string) {
    if (!rename) return;
    const v = value.trim();
    const { labels } = await api.setLabel(rename.key, v === rename.base ? '' : v);
    onLabelsChange(labels);
    setRename(null);
  }

  const stopNumber = (s: Stop) => (plan ? plan.stops.indexOf(s) + 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Day */}
      <div className="flex flex-wrap gap-2">
        {campus.days.map((d) => (
          <button key={d} type="button" onClick={() => onViewChange(d)}
            className={`text-base font-black rounded-xl px-5 py-2.5 border-2 ${view === d ? 'bg-rtc-ink border-rtc-ink text-white' : 'bg-white border-slate-300 text-rtc-gray'}`}>
            {d}
          </button>
        ))}
        <button type="button" onClick={() => onViewChange('week')}
          className={`text-base font-black rounded-xl px-5 py-2.5 border-2 ${view === 'week' ? 'bg-rtc-ink border-rtc-ink text-white' : 'bg-white border-slate-300 text-rtc-gray'}`}>
          Whole week
        </button>
      </div>

      {/* Group — one walk at a time keeps the board readable */}
      {view !== 'week' && (
        <div className="grid grid-cols-2 gap-3">
          {(['A', 'B'] as Group[]).map((g) => {
            const on = group === g;
            const n = campus.buildings.filter((b) => b.day === view && b.group === g).length;
            return (
              <button key={g} type="button" onClick={() => setGroup(g)}
                className="rounded-2xl px-5 py-3 text-left border-4"
                style={{ borderColor: on ? GROUP_COLOR[g] : '#E2E8F0', background: on ? GROUP_COLOR[g] : '#fff', color: on ? '#fff' : '#6B7A87' }}>
                <div className="text-xl font-black leading-tight">{GROUP_NAME[g]}</div>
                <div className="text-sm font-bold opacity-90">{GROUP_SUB[g]} · {n} building{n === 1 ? '' : 's'}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Map */}
      <div className="relative rounded-3xl overflow-hidden border-4 border-white shadow-md" style={{ background: '#A8D68A' }}>
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-auto block select-none" role="img"
          aria-label={view === 'week' ? 'Campus map' : `${view} ${GROUP_NAME[group]} walking route`}>
          <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#A8D68A" />

          {LANDMARKS.map((lm, i) => <Landmark key={i} lm={lm} />)}

          {SIDEWALKS.map((s, i) => (
            <line key={i} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="#F1E7CC" strokeWidth={40} strokeLinecap="round" />
          ))}

          {TREES.filter((_, i) => i % 3 === 0).map((tr, i) => (
            <g key={i} pointerEvents="none">
              <circle cx={tr.x} cy={tr.y} r={(tr.r ?? 22) * 0.9} fill="#63AC4E" />
              <circle cx={tr.x - 6} cy={tr.y - 6} r={(tr.r ?? 22) * 0.5} fill="#7BC565" />
            </g>
          ))}

          {/* Buildings */}
          {LAYOUTS.map((l) => {
            const info = infoByKey.get(l.key);
            const lit = isLit(l.key);
            const name = bLabel(campus, l.key);
            const gcolor = info ? GROUP_COLOR[info.group] : '#1A2733';
            const parts: Array<{ rect: Rect; rows?: BuildingLayout['rows']; main: boolean }> = [
              { rect: l.rect, rows: l.rows, main: true },
              ...(l.annex ?? []).map((a) => ({ rect: a.rect, rows: a.rows, main: false })),
            ];
            return (
              <g key={l.key} style={{ cursor: 'pointer' }}
                onClick={() => onSelect(selected === l.key ? null : l.key)}
                onDoubleClick={(e) => { e.stopPropagation(); setRename({ key: `b:${l.key}`, title: 'Rename building', base: info?.name ?? l.key, current: name, at: { x: l.rect.x + l.rect.w / 2, y: l.rect.y } }); }}>
                {parts.map(({ rect, rows }, pi) => (
                  <g key={pi}>
                    <rect x={rect.x + 5} y={rect.y + 8} width={rect.w} height={rect.h} rx={18} fill="#000" opacity={0.12} />
                    <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={18} fill={lit ? l.color : QUIET_FILL} />
                    {lit && <rect x={rect.x - 5} y={rect.y - 5} width={rect.w + 10} height={rect.h + 10} rx={23} fill="none" stroke={gcolor} strokeWidth={7} />}
                    {lit && rows && layoutTiles(rect, rows).map((tile, ti) => {
                      if ('corridor' in tile) {
                        const c = tile.rect;
                        return (
                          <g key={ti}>
                            <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={6} fill="#FBF6E6" stroke={shade(l.color, -0.15)} strokeWidth={2} />
                          </g>
                        );
                      }
                      const r = tile.rect;
                      const isHome = l.key === HOME.building && tile.room === HOME.room;
                      const stop = plan?.stops.find((s) => s.buildingKey === l.key && s.signup.room === tile.room && !s.signup.isCustom);
                      return (
                        <g key={ti} onDoubleClick={(e) => { e.stopPropagation(); setRename({ key: `r:${l.key}|${tile.room}`, title: 'Rename room', base: tile.room, current: rLabel(campus, l.key, tile.room), at: { x: r.x + r.w / 2, y: r.y } }); }}>
                          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={8}
                            fill={isHome ? '#FFE9A8' : stop ? '#FFFFFF' : shade(l.color, 0.2)}
                            stroke={isHome ? HOME_COLOR : stop ? gcolor : shade(l.color, -0.08)}
                            strokeWidth={isHome || stop ? 5 : 1.5} />
                          <TileText label={rLabel(campus, l.key, tile.room)} rect={r} fill="#1A2733" max={stop ? 26 : 17} weight={stop ? 900 : 700} />
                        </g>
                      );
                    })}
                  </g>
                ))}

                {/* Name plate */}
                {(() => {
                  const h = lit ? 44 : 30;
                  const w = Math.min(l.rect.w + 40, name.length * (lit ? 18 : 12) + 40);
                  const x = l.rect.x + l.rect.w / 2 - w / 2;
                  return (
                    <g pointerEvents="none">
                      <rect x={x} y={l.rect.y - h / 2 - 6} width={w} height={h} rx={h / 2} fill={lit ? '#FFFFFF' : '#D3E5C6'} stroke={lit ? gcolor : 'none'} strokeWidth={5} />
                      <TileText label={name} rect={{ x, y: l.rect.y - h / 2 - 6, w, h }} fill={lit ? '#1A2733' : QUIET_INK} max={lit ? 28 : 18} weight={900} />
                    </g>
                  );
                })()}

                {view === 'week' && info && (
                  <g pointerEvents="none">
                    <rect x={l.rect.x + l.rect.w - 104} y={l.rect.y + l.rect.h - 18} width={100} height={40} rx={20} fill={GROUP_COLOR[info.group]} stroke="white" strokeWidth={4} />
                    <text x={l.rect.x + l.rect.w - 54} y={l.rect.y + l.rect.h + 10} textAnchor="middle" fontSize={22} fontWeight={900} fill="white">
                      {info.day.slice(0, 3)} · {info.group}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* The walk */}
          {plan && plan.pts.length > 0 && (
            <g pointerEvents="none">
              <path d={plan.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={24} strokeLinejoin="round" strokeLinecap="round" />
              <path d={plan.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke={GROUP_COLOR[group]} strokeWidth={12} strokeLinejoin="round" strokeLinecap="round" opacity={0.28} />
              {walkedPath && <path d={walkedPath} fill="none" stroke={GROUP_COLOR[group]} strokeWidth={12} strokeLinejoin="round" strokeLinecap="round" />}
            </g>
          )}

          {/* Numbered classroom stops */}
          {plan?.stops.map((s) => {
            const n = stopNumber(s);
            const done = s.at <= walked + 1;
            const here = atStop === s;
            return (
              <g key={s.signup.id} pointerEvents="none">
                <circle cx={s.door.x} cy={s.door.y} r={here ? 24 : 19}
                  fill={done ? GROUP_COLOR[group] : '#FFFFFF'} stroke={done ? '#FFFFFF' : GROUP_COLOR[group]} strokeWidth={5} />
                <text x={s.door.x} y={s.door.y + (here ? 9 : 7)} textAnchor="middle" fontSize={here ? 26 : 21} fontWeight={900}
                  fill={done ? '#FFFFFF' : GROUP_COLOR[group]}>{n}</text>
              </g>
            );
          })}

          {/* Home */}
          {(() => {
            const l = layoutByKey.get(HOME.building);
            const r = l ? roomRect(l, HOME.room) : null;
            if (!r) return null;
            const c = center(r);
            return (
              <g pointerEvents="none">
                <circle cx={c.x} cy={c.y} r={34} fill={HOME_COLOR} stroke="white" strokeWidth={6} />
                <text x={c.x} y={c.y + 12} textAnchor="middle" fontSize={32}>🏠</text>
              </g>
            );
          })()}

          {/* Walker */}
          {walker && (
            <g pointerEvents="none">
              <ellipse cx={walker.x} cy={walker.y + 30} rx={26} ry={7} fill="#000" opacity={0.18} />
              <rect x={walker.x - 20} y={walker.y - 4} width={40} height={34} rx={16} fill={GROUP_COLOR[group]} stroke="white" strokeWidth={5} />
              <circle cx={walker.x} cy={walker.y - 18} r={20} fill="#FFDDB8" stroke="white" strokeWidth={5} />
              <path d={`M${walker.x - 20},${walker.y - 20} a20,20 0 0 1 40,0 z`} fill={GROUP_COLOR[group]} />
              <rect x={walker.x + 14} y={walker.y + 2} width={26} height={26} rx={6} fill="#2E7D32" stroke="white" strokeWidth={4} />
              <text x={walker.x + 27} y={walker.y + 22} textAnchor="middle" fontSize={17} fontWeight={900} fill="white">♻</text>
            </g>
          )}
        </svg>

        {rename && (
          <RenamePopover rename={rename}
            style={{ left: `${(rename.at.x / MAP_W) * 100}%`, top: `${(rename.at.y / MAP_H) * 100}%` }}
            onSave={saveRename} onCancel={() => setRename(null)} />
        )}
      </div>

      {/* Walk-through control */}
      {view !== 'week' && plan && (
        plan.stops.length === 0 ? (
          <div className="rounded-2xl border-4 border-slate-200 p-4 font-bold text-rtc-gray">
            No bins signed up for {GROUP_NAME[group]} on {view} yet — nothing to walk.
          </div>
        ) : (
          <div className="rounded-2xl border-4 p-4 flex flex-col gap-3" style={{ borderColor: GROUP_COLOR[group] }}>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => { if (walked >= total) setWalked(0); setPlaying(!playing); }}
                className="text-lg font-black rounded-xl px-6 py-3 text-white" style={{ background: GROUP_COLOR[group] }}>
                {playing ? '⏸ Pause' : walked >= total ? '↻ Walk it again' : '▶ Walk the route'}
              </button>
              <div className="text-2xl font-black" style={{ color: GROUP_COLOR[group] }}>
                {walked <= 0
                  ? '🏠 Start at DA4'
                  : walked >= total
                    ? '🏠 Back at DA4 — all done!'
                    : atStop
                      ? `Stop ${stopNumber(atStop)}: ${atStop.label} · ${atStop.who}`
                      : current
                        ? `Walking to ${current.label}…`
                        : 'Walking home…'}
              </div>
            </div>
            <input type="range" min={0} max={Math.max(1, Math.round(total))} value={Math.round(walked)}
              onChange={(e) => { setPlaying(false); setWalked(Number(e.target.value)); }}
              className="w-full h-4 cursor-pointer" style={{ accentColor: GROUP_COLOR[group] }}
              aria-label="Walk along the route" />
            <ol className="flex flex-wrap items-stretch gap-2">
              <Chip color={HOME_COLOR} ink="#4A3200" label="🏠 Start" sub="DA4" active={walked <= 0} />
              {plan.stops.map((s) => (
                <Chip key={s.signup.id} color={GROUP_COLOR[group]} ink="#fff" num={stopNumber(s)}
                  label={s.label} sub={s.who} active={atStop === s} done={s.at <= walked + 1}
                  onClick={() => { setPlaying(false); setWalked(s.at); }} />
              ))}
              <Chip color={HOME_COLOR} ink="#4A3200" label="🏠 Finish" sub="DA4" active={walked >= total} />
            </ol>
          </div>
        )
      )}

      <p className="text-sm text-rtc-gray font-bold">
        Double-click any building or room to rename it.
      </p>
    </div>
  );
}

function Landmark({ lm }: { lm: { kind: string; rect: { x: number; y: number; w: number; h: number }; label: string } }) {
  const { x, y, w, h } = lm.rect;
  const cx = x + w / 2, cy = y + h / 2;
  const cap = (fill: string, ink = '#3D5A32') => (
    <text x={cx} y={y + h - 12} textAnchor="middle" fontSize={22} fontWeight={900} fill={ink} stroke={fill} strokeWidth={5} paintOrder="stroke">
      {lm.label}
    </text>
  );
  switch (lm.kind) {
    case 'track':
      return (
        <g pointerEvents="none">
          <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="#C97B54" />
          <rect x={x + 22} y={y + 22} width={w - 44} height={h - 44} rx={(h - 44) / 2} fill="#7CC061" />
          {cap('#7CC061')}
        </g>
      );
    case 'diamond':
      return (
        <g pointerEvents="none">
          <path d={`M${x + 12},${y + h - 12} L${cx},${y + 16} L${x + w - 12},${y + h - 12} Z`} fill="#7CC061" />
          <path d={`M${x + 60},${y + h - 40} L${cx},${y + 70} L${x + w - 60},${y + h - 40} Z`} fill="#D6A16B" />
          {cap('#7CC061')}
        </g>
      );
    case 'tennis':
      return (
        <g pointerEvents="none">
          <rect x={x} y={y} width={w} height={h} rx={14} fill="#4E8FC7" />
          {[0.33, 0.66].map((f) => <line key={f} x1={x + w * f} y1={y + 8} x2={x + w * f} y2={y + h - 8} stroke="white" strokeWidth={3} />)}
          <line x1={x + 8} y1={cy} x2={x + w - 8} y2={cy} stroke="white" strokeWidth={3} />
          {cap('#4E8FC7', '#FFFFFF')}
        </g>
      );
    case 'pool':
      return (
        <g pointerEvents="none">
          <rect x={x} y={y} width={w} height={h} rx={16} fill="#5FB4E5" stroke="#E9F3F8" strokeWidth={6} />
          {cap('#5FB4E5', '#FFFFFF')}
        </g>
      );
    case 'parking':
      return (
        <g pointerEvents="none">
          <rect x={x} y={y} width={w} height={h} rx={14} fill="#9AA5A0" />
          {Array.from({ length: Math.max(2, Math.floor(w / 60)) }, (_, i) => (
            <line key={i} x1={x + 20 + i * 58} y1={y + 12} x2={x + 20 + i * 58} y2={y + h - 12} stroke="#E6EAE8" strokeWidth={4} />
          ))}
          {cap('#9AA5A0', '#FFFFFF')}
        </g>
      );
    case 'amphitheatre':
      return (
        <g pointerEvents="none">
          <rect x={x} y={y} width={w} height={h} rx={18} fill="#C9BBA0" />
          {[0.25, 0.45, 0.65].map((f) => (
            <path key={f} d={`M${x + 14},${y + h * f} Q${cx},${y + h * (f - 0.2)} ${x + w - 14},${y + h * f}`} fill="none" stroke="#EFE6D2" strokeWidth={7} />
          ))}
          {cap('#C9BBA0')}
        </g>
      );
    case 'quad':
    default:
      return (
        <g pointerEvents="none">
          <rect x={x} y={y} width={w} height={h} rx={40} fill="#98CC78" />
          {cap('#98CC78')}
        </g>
      );
  }
}

function Chip({ color, ink, num, label, sub, active, done, onClick }: {
  color: string; ink: string; num?: number; label: string; sub?: string;
  active?: boolean; done?: boolean; onClick?: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} disabled={!onClick}
        className={`flex items-center gap-2 rounded-2xl px-3 py-2 border-4 text-left ${active ? 'scale-105' : ''}`}
        style={{
          background: done || active ? color : '#fff',
          color: done || active ? ink : '#6B7A87',
          borderColor: active ? '#1A2733' : color,
        }}>
        {num !== undefined && (
          <span className="flex items-center justify-center w-9 h-9 rounded-full text-lg font-black shrink-0"
            style={{ background: done || active ? 'rgba(255,255,255,0.95)' : color, color: done || active ? color : '#fff' }}>
            {num}
          </span>
        )}
        <span className="leading-tight">
          <span className="block text-lg font-black">{label}</span>
          {sub && <span className="block text-xs font-bold opacity-90">{sub}</span>}
        </span>
      </button>
    </li>
  );
}

function RenamePopover({ rename, style, onSave, onCancel }: {
  rename: Rename; style: { left: string; top: string }; onSave: (v: string) => void; onCancel: () => void;
}) {
  const [value, setValue] = useState(rename.current);
  const [busy, setBusy] = useState(false);
  const overridden = rename.current !== rename.base;
  return (
    <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); await onSave(value); }}
      className="absolute -translate-x-1/2 -translate-y-full bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-3 w-64 flex flex-col gap-2 z-10"
      style={{ ...style, marginTop: -8 }} onClick={(e) => e.stopPropagation()}>
      <div className="text-xs font-black text-rtc-gray">{rename.title}</div>
      <input autoFocus type="text" value={value} onChange={(e) => setValue(e.target.value)} maxLength={60}
        onFocus={(e) => e.target.select()} className="border-2 border-blue-300 rounded-lg px-2 py-1.5 font-bold text-sm" />
      {overridden && <div className="text-[11px] text-rtc-gray">Original: <b>{rename.base}</b></div>}
      <div className="flex gap-2 justify-end">
        {overridden && <button type="button" onClick={() => onSave('')} className="text-xs font-bold text-rtc-gray mr-auto underline">Reset</button>}
        <button type="button" onClick={onCancel} className="text-xs font-bold text-rtc-gray px-2 py-1">Cancel</button>
        <button type="submit" disabled={busy || !value.trim()} className="text-xs font-bold bg-rtc-green text-white rounded-lg px-3 py-1 disabled:opacity-50">Save</button>
      </div>
    </form>
  );
}
