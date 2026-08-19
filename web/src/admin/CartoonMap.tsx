import { useEffect, useMemo, useRef, useState } from 'react';
import { api, bLabel, rLabel, type Campus, type Day, type Group, type Signup } from '../lib/api';
import {
  AERIAL_CREDIT,
  AERIAL_SRC,
  BUILDINGS as LAYOUTS,
  EXTRAS,
  HOME,
  LANDMARKS,
  MAP_H,
  MAP_W,
  SIDEWALKS,
  bounds,
  center,
  cumulative,
  findRoom,
  frameSpine,
  layoutTiles,
  nearerEnd,
  pointAtDistance,
  roomDoorLocal,
  routeAlongSidewalks,
  toLocal,
  toWorld,
  type BuildingLayout,
  type Frame,
  type Pt,
  type Rect,
  type Segment,
} from '../lib/campusLayout';

/*
 * The campus, traced from an aerial photo, with the walk drawn door to door.
 * Built to be read on the classroom board: nothing moves on its own, one
 * group's walk at a time, big type, and everything not on today's walk
 * pushed back. Scroll to zoom, drag to pan.
 */

const GROUP_COLOR: Record<Group, string> = { A: '#C2255C', B: '#1565C0' };
const GROUP_NAME: Record<Group, string> = { A: 'Group A', B: 'Group B' };
const GROUP_SUB: Record<Group, string> = { A: 'Close to home', B: 'Around campus' };
const HOME_COLOR = '#F9A825';
const QUIET_FILL = '#D9E4CF';
const QUIET_INK = '#5C7A52';

type View = Day | 'week';
type Rename = { key: string; title: string; base: string; current: string; at: Pt };
type Stop = { signup: Signup; buildingKey: string; label: string; who: string; door: Pt; at: number };
type ViewBox = { x: number; y: number; w: number; h: number };

const FULL: ViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)));
  return `#${((ch(n >> 16) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, '0')}`;
}

function poly(pts: Pt[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

function fitText(label: string, w: number, h: number, max: number) {
  const avail = w - 6;
  const one = Math.min(h * 0.62, max, (avail * 1.9) / Math.max(1, label.length));
  if (one >= max * 0.55 || !label.includes(' ')) return { lines: [label], size: Math.max(6, one) };
  const words = label.split(' ');
  let cut = 1, bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) { bestDiff = diff; cut = i; }
  }
  const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
  const longest = Math.max(...lines.map((l) => l.length));
  return { lines, size: Math.max(6, Math.min(h * 0.4, max * 0.8, (avail * 1.9) / longest)) };
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
  const [vb, setVb] = useState<ViewBox>(FULL);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vb: ViewBox; moved: boolean } | null>(null);

  const layoutByKey = useMemo(() => new Map(LAYOUTS.map((l) => [l.key, l])), []);
  const infoByKey = useMemo(() => new Map(campus.buildings.map((b) => [b.key, b])), [campus]);

  /* ---------- the walk ---------- */

  const plan = useMemo(() => {
    if (view === 'week') return null;
    const todays = campus.buildings.filter((b) => b.day === view && b.group === group);
    const home = layoutByKey.get(HOME.building);
    const homeRoom = home ? findRoom(home, HOME.room) : null;
    if (!home || !homeRoom) return null;

    const spineFor = (l: BuildingLayout, f: Frame, main: boolean): Segment => {
      const local = frameSpine(f, toLocal(l.entrance, f), l.walkway, main ? l.spine : undefined);
      return { a: toWorld(local.a, f), b: toWorld(local.b, f) };
    };

    const homeSpine = spineFor(home, homeRoom.frame, true);
    const hd = roomDoorLocal(homeRoom.rect, frameSpine(homeRoom.frame, toLocal(home.entrance, homeRoom.frame), home.walkway, home.spine));
    const homeStart = { door: toWorld(hd.door, homeRoom.frame), hall: toWorld(hd.hall, homeRoom.frame) };

    const pts: Pt[] = [homeStart.door, homeStart.hall];
    const marks: Array<{ index: number; stop: Omit<Stop, 'at'> }> = [];
    const visited: string[] = [];
    let cur: Pt = homeStart.hall;
    let inside: { key: string; spine: Segment; entrance: Pt; door?: Pt } | null =
      { key: `${HOME.building}#0`, spine: homeSpine, entrance: home.entrance, door: home.door };

    const stepOutside = () => {
      if (!inside) return;
      const exit = nearerEnd(inside.spine, inside.door ?? inside.entrance);
      pts.push(exit);
      if (inside.door) pts.push(inside.door);
      pts.push(inside.entrance);
      cur = inside.entrance;
      inside = null;
    };

    for (const b of todays) {
      const l = layoutByKey.get(b.key);
      if (!l) continue;
      const mine = signups.filter((s) => s.building === b.key);
      if (!mine.length) continue;
      visited.push(b.key);
      let touched = false;

      l.frames.forEach((frame, fi) => {
        const id = `${b.key}#${fi}`;
        const tiles = layoutTiles(frame.rect, frame.rows).filter((t) => 'room' in t) as Array<{ room: string; rect: Rect }>;
        const here = mine.filter((s) => !s.isCustom && tiles.some((t) => t.room === s.room));
        if (!here.length) return;
        touched = true;

        if (inside?.key !== id) {
          stepOutside();
          pts.push(...routeAlongSidewalks(cur, l.entrance).slice(1));
          cur = l.entrance;
          const spine = spineFor(l, frame, fi === 0);
          if (fi === 0 && l.door) { pts.push(l.door); cur = l.door; }
          const entry = nearerEnd(spine, cur);
          pts.push(entry);
          cur = entry;
          inside = { key: id, spine, entrance: l.entrance, door: fi === 0 ? l.door : undefined };
        }

        const localSpine = frameSpine(frame, toLocal(l.entrance, frame), l.walkway, fi === 0 ? l.spine : undefined);
        const remaining = here.map((s) => {
          const d = roomDoorLocal(tiles.find((t) => t.room === s.room)!.rect, localSpine);
          return { s, door: toWorld(d.door, frame), hall: toWorld(d.hall, frame) };
        });
        while (remaining.length) {
          remaining.sort((a, z) => Math.hypot(a.hall.x - cur.x, a.hall.y - cur.y) - Math.hypot(z.hall.x - cur.x, z.hall.y - cur.y));
          const d = remaining.shift()!;
          pts.push(d.hall, d.door);
          marks.push({ index: pts.length - 1, stop: { signup: d.s, buildingKey: b.key, label: d.s.roomLabel, who: d.s.name, door: d.door } });
          pts.push(d.hall);
          cur = d.hall;
        }
      });

      const customs = mine.filter((s) => s.isCustom);
      if (customs.length) {
        if (!touched || inside) {
          stepOutside();
          pts.push(...routeAlongSidewalks(cur, l.entrance).slice(1));
          cur = l.entrance;
        }
        for (const c of customs) {
          marks.push({ index: pts.length - 1, stop: { signup: c, buildingKey: b.key, label: c.roomLabel, who: c.name, door: l.entrance } });
        }
      }
    }

    if (!visited.length) return { pts: [], stops: [], total: 0, visited };

    if (inside?.key === `${HOME.building}#0`) {
      pts.push(homeStart.hall, homeStart.door);
    } else {
      stepOutside();
      pts.push(...routeAlongSidewalks(cur, home.entrance).slice(1));
      if (home.door) pts.push(home.door);
      pts.push(nearerEnd(homeSpine, home.door ?? home.entrance), homeStart.hall, homeStart.door);
    }

    const cum = cumulative(pts);
    const stops: Stop[] = marks.map((m) => ({ ...m.stop, at: cum[m.index] }));
    return { pts, stops, total: cum[cum.length - 1], visited };
  }, [campus, view, group, signups, layoutByKey]);

  const total = plan?.total ?? 0;
  useEffect(() => { setWalked(0); setPlaying(false); }, [view, group]);

  const walkedRef = useRef(walked);
  walkedRef.current = walked;
  useEffect(() => {
    if (!playing || !total) return;
    let last = performance.now();
    const speed = total / 18000;
    let raf = 0;
    const tick = (now: number) => {
      const next = walkedRef.current + (now - last) * speed;
      last = now;
      if (next >= total) { setWalked(total); setPlaying(false); return; }
      setWalked(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  const litKeys = useMemo(() => (view === 'week' ? null : new Set(plan?.visited ?? [])), [plan, view]);
  const isLit = (k: string) => (litKeys ? litKeys.has(k) : true);

  const doneStops = plan ? plan.stops.filter((s) => s.at <= walked + 1).length : 0;
  const current = plan?.stops[Math.min(doneStops, plan.stops.length - 1)];
  const atStop = plan?.stops.find((s) => Math.abs(s.at - walked) < 10);
  const walker = plan && plan.pts.length ? pointAtDistance(plan.pts, walked) : null;
  const walkedPath = useMemo(() => {
    if (!plan || !plan.pts.length) return '';
    const cum = cumulative(plan.pts);
    const out: Pt[] = [];
    for (let i = 0; i < plan.pts.length; i++) { if (cum[i] <= walked) out.push(plan.pts[i]); else break; }
    if (walker) out.push(walker);
    return out.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  }, [plan, walked, walker]);

  /* ---------- zoom / pan ---------- */

  const clampVb = (v: ViewBox): ViewBox => {
    const w = Math.min(MAP_W, Math.max(MAP_W / 6, v.w));
    const h = w * (MAP_H / MAP_W);
    const x = Math.min(MAP_W - w, Math.max(0, v.x));
    const y = Math.min(MAP_H - h, Math.max(0, v.y));
    return { x, y, w, h };
  };
  const zoomAt = (factor: number, fx = 0.5, fy = 0.5) => {
    setVb((v) => {
      const w = v.w / factor;
      const h = v.h / factor;
      return clampVb({ x: v.x + (v.w - w) * fx, y: v.y + (v.h - h) * fy, w, h });
    });
  };
  const zoomTo = (r: Rect, pad = 1.6) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const w = Math.max(r.w, r.h * (MAP_W / MAP_H)) * pad;
    setVb(clampVb({ x: cx - w / 2, y: cy - (w * MAP_H / MAP_W) / 2, w, h: w * MAP_H / MAP_W }));
  };
  useEffect(() => {
    // native listener so we can preventDefault on wheel (React's is passive)
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const b = el.getBoundingClientRect();
      const fx = (e.clientX - b.left) / b.width, fy = (e.clientY - b.top) / b.height;
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, fx, fy);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

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
  const zoomed = vb.w < MAP_W - 1;
  // Text sizes shrink as we zoom in so labels don't become billboards.
  const tscale = Math.max(0.55, Math.min(1, vb.w / MAP_W));
  // Route, stops, walker and home shrink faster than text, so zooming in
  // reveals the rooms instead of burying them under fat strokes.
  const k = Math.max(0.3, Math.min(1, vb.w / MAP_W));

  const homeLayout = layoutByKey.get(HOME.building);
  const homeCenter = homeLayout ? (() => { const f = findRoom(homeLayout, HOME.room); return f ? toWorld(center(f.rect), f.frame) : null; })() : null;

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

      {view !== 'week' && (
        <div className="grid grid-cols-2 gap-3">
          {(['A', 'B'] as Group[]).map((g) => {
            const on = group === g;
            const n = campus.buildings.filter((b) => b.day === view && b.group === g).length;
            return (
              <button key={g} type="button" onClick={() => setGroup(g)} className="rounded-2xl px-5 py-3 text-left border-4"
                style={{ borderColor: on ? GROUP_COLOR[g] : '#E2E8F0', background: on ? GROUP_COLOR[g] : '#fff', color: on ? '#fff' : '#6B7A87' }}>
                <div className="text-xl font-black leading-tight">{GROUP_NAME[g]}</div>
                <div className="text-sm font-bold opacity-90">{GROUP_SUB[g]} · {n} building{n === 1 ? '' : 's'}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Map */}
      <div className="relative rounded-3xl overflow-hidden border-4 border-white shadow-md bg-[#8fb87a]">
        <svg
          ref={svgRef}
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="w-full h-auto block select-none"
          style={{ cursor: 'grab', touchAction: 'none' }}
          role="img"
          aria-label={view === 'week' ? 'Campus map' : `${view} ${GROUP_NAME[group]} walking route`}
          onMouseDown={(e) => { if (e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, vb, moved: false }; }}
          onMouseMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const el = svgRef.current!;
            const b = el.getBoundingClientRect();
            const dx = ((e.clientX - d.x) / b.width) * d.vb.w;
            const dy = ((e.clientY - d.y) / b.height) * d.vb.h;
            if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
            if (d.moved) setVb(clampVb({ ...d.vb, x: d.vb.x - dx, y: d.vb.y - dy }));
          }}
          onMouseUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
          onMouseLeave={() => { drag.current = null; }}
        >
          {/* The real campus */}
          <image href={AERIAL_SRC} x={0} y={0} width={MAP_W} height={MAP_H} preserveAspectRatio="none" />
          <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#F4F6EE" opacity={view === 'week' ? 0.22 : 0.36} />

          {/* Sidewalks, traced */}
          {SIDEWALKS.map((s, i) => (
            <line key={`s${i}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} stroke="#F3E9CF" strokeWidth={22} strokeLinecap="round" opacity={0.9} />
          ))}

          {/* Other places, traced but quiet */}
          {EXTRAS.map((e, i) => {
            const bb = bounds(e.outline);
            if (e.kind === 'court') {
              return (
                <g key={i} pointerEvents="none">
                  <polygon points={poly(e.outline)} fill="#7C8C86" opacity={0.55} />
                  {e.label && <TileText label={e.label} rect={bb} fill="#FFFFFF" max={26 * tscale} weight={800} />}
                </g>
              );
            }
            if (e.kind === 'seating') {
              return (
                <g key={i} pointerEvents="none">
                  <polygon points={poly(e.outline)} fill="#E7DCC4" stroke="#C9BBA0" strokeWidth={3} opacity={0.9} />
                  {e.label && <TileText label={e.label} rect={bb} fill="#6B5A3E" max={24 * tscale} weight={800} />}
                </g>
              );
            }
            return (
              <g key={i} pointerEvents="none">
                <polygon points={poly(e.outline.map((p) => ({ x: p.x + 4, y: p.y + 6 })))} fill="#000" opacity={0.12} />
                <polygon points={poly(e.outline)} fill={QUIET_FILL} stroke={shade(QUIET_FILL, -0.12)} strokeWidth={2} />
                {e.label && <TileText label={e.label} rect={bb} fill={QUIET_INK} max={24 * tscale} weight={800} />}
              </g>
            );
          })}

          {/* Places the students know */}
          {LANDMARKS.map((lm, i) => {
            const fs = 20 * tscale;
            const w = lm.label.length * fs * 0.62 + 26;
            return (
              <g key={i} pointerEvents="none">
                <rect x={lm.at.x - w / 2} y={lm.at.y - fs * 0.85} width={w} height={fs * 1.7} rx={fs * 0.85} fill="#FFFFFF" opacity={0.88} />
                <text x={lm.at.x} y={lm.at.y + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={800} fill="#3D5A32">{lm.label}</text>
              </g>
            );
          })}

          {/* Buildings */}
          {LAYOUTS.map((l) => {
            const info = infoByKey.get(l.key);
            const lit = isLit(l.key);
            const name = bLabel(campus, l.key);
            const gcolor = info ? GROUP_COLOR[info.group] : '#1A2733';
            const bb = bounds(l.outline);
            return (
              <g key={l.key} style={{ cursor: 'pointer' }}
                onClick={() => { if (drag.current?.moved) return; onSelect(selected === l.key ? null : l.key); }}
                onDoubleClick={(e) => { e.stopPropagation(); setRename({ key: `b:${l.key}`, title: 'Rename building', base: info?.name ?? l.key, current: name, at: { x: bb.x + bb.w / 2, y: bb.y } }); }}>
                {/* footprint */}
                <polygon points={poly(l.outline.map((p) => ({ x: p.x + (l.upstairs ? 6 : 4), y: p.y + (l.upstairs ? 10 : 6) })))} fill="#000" opacity={l.upstairs ? 0.2 : 0.14} />
                <polygon points={poly(l.outline)} fill={lit ? l.color : QUIET_FILL} stroke={lit ? gcolor : shade(QUIET_FILL, -0.15)} strokeWidth={lit ? 5 : 2} strokeLinejoin="round" />

                {/* room frames (only when the building is in play) */}
                {lit && l.frames.map((f, fi) => {
                  const c = center(f.rect);
                  return (
                    <g key={fi} transform={f.angle ? `rotate(${f.angle} ${c.x} ${c.y})` : undefined}>
                      {layoutTiles(f.rect, f.rows).map((tile, ti) => {
                        if ('corridor' in tile) {
                          const r = tile.rect;
                          return <rect key={ti} x={r.x} y={r.y} width={r.w} height={r.h} rx={4} fill="#FBF6E6" stroke={shade(l.color, -0.15)} strokeWidth={1.5} />;
                        }
                        const r = tile.rect;
                        const isHome = l.key === HOME.building && tile.room === HOME.room;
                        const stop = plan?.stops.find((s) => s.buildingKey === l.key && s.signup.room === tile.room && !s.signup.isCustom);
                        return (
                          <g key={ti} onDoubleClick={(e) => { e.stopPropagation(); setRename({ key: `r:${l.key}|${tile.room}`, title: 'Rename room', base: tile.room, current: rLabel(campus, l.key, tile.room), at: toWorld({ x: r.x + r.w / 2, y: r.y }, f) }); }}>
                            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={4}
                              fill={isHome ? '#FFE9A8' : stop ? '#FFFFFF' : shade(l.color, 0.2)}
                              stroke={isHome ? HOME_COLOR : stop ? gcolor : shade(l.color, -0.08)}
                              strokeWidth={isHome || stop ? 3 : 1} />
                            <TileText label={rLabel(campus, l.key, tile.room)} rect={r} fill="#1A2733" max={stop ? 16 : 12} weight={stop ? 900 : 700} />
                          </g>
                        );
                      })}
                    </g>
                  );
                })}

                {/* name plate */}
                {l.nameplate !== 'none' && (() => {
                  const tag = view === 'week' && info ? ` · ${info.day.slice(0, 3)} ${info.group}` : '';
                  const label = name + tag;
                  const fs = (lit ? 22 : 15) * tscale;
                  const h = fs * 1.9;
                  const w = label.length * fs * 0.6 + fs * 1.4;
                  const side = l.nameplate ?? 'top';
                  const cx = l.nameAt?.x ?? bb.x + bb.w / 2, cy = l.nameAt?.y ?? bb.y + bb.h / 2;
                  let x = cx - w / 2, y = cy - h / 2;
                  if (!l.nameAt) {
                    if (side === 'left') { x = bb.x - 8 - w; }
                    if (side === 'right') { x = bb.x + bb.w + 8; }
                    if (side === 'top') { y = bb.y - h / 2 - 5; }
                    if (side === 'bottom') { y = bb.y + bb.h - h / 2 + 5; }
                  }
                  return (
                    <g pointerEvents="none">
                      <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={lit ? '#FFFFFF' : '#EAF0E3'} stroke={lit ? gcolor : 'none'} strokeWidth={4} opacity={lit ? 1 : 0.95} />
                      <text x={x + w / 2} y={y + h / 2 + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight={900} fill={lit ? '#1A2733' : QUIET_INK}>{label}</text>
                    </g>
                  );
                })()}

                {l.upstairs && lit && (
                  <text pointerEvents="none" x={bb.x + bb.w + 6} y={bb.y + bb.h / 2 + 5} fontSize={14 * tscale} fontWeight={900} fill={gcolor}>▲ up</text>
                )}
              </g>
            );
          })}

          {/* The walk */}
          {plan && plan.pts.length > 0 && (
            <g pointerEvents="none">
              <path d={plan.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke="#FFFFFF" strokeWidth={16 * k} strokeLinejoin="round" strokeLinecap="round" />
              <path d={plan.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} fill="none" stroke={GROUP_COLOR[group]} strokeWidth={8 * k} strokeLinejoin="round" strokeLinecap="round" opacity={0.3} />
              {walkedPath && <path d={walkedPath} fill="none" stroke={GROUP_COLOR[group]} strokeWidth={8 * k} strokeLinejoin="round" strokeLinecap="round" />}
            </g>
          )}

          {/* Numbered stops */}
          {plan?.stops.map((s) => {
            const n = stopNumber(s);
            const done = s.at <= walked + 1;
            const here = atStop === s;
            const r = (here ? 17 : 13) * k;
            return (
              <g key={s.signup.id} pointerEvents="none">
                <circle cx={s.door.x} cy={s.door.y} r={r} fill={done ? GROUP_COLOR[group] : '#FFFFFF'} stroke={done ? '#FFFFFF' : GROUP_COLOR[group]} strokeWidth={3.5 * k} />
                <text x={s.door.x} y={s.door.y + r * 0.38} textAnchor="middle" fontSize={r * 1.15} fontWeight={900} fill={done ? '#FFFFFF' : GROUP_COLOR[group]}>{n}</text>
              </g>
            );
          })}

          {/* Home */}
          {homeCenter && (
            <g pointerEvents="none">
              <circle cx={homeCenter.x} cy={homeCenter.y} r={18 * k} fill={HOME_COLOR} stroke="white" strokeWidth={4 * k} />
              <text x={homeCenter.x} y={homeCenter.y + 7 * k} textAnchor="middle" fontSize={19 * k}>🏠</text>
            </g>
          )}

          {/* Walker */}
          {walker && (
            <g pointerEvents="none" transform={`translate(${walker.x} ${walker.y}) scale(${k})`}>
              <ellipse cx={0} cy={22} rx={20} ry={5} fill="#000" opacity={0.18} />
              <rect x={-14} y={-2} width={28} height={24} rx={11} fill={GROUP_COLOR[group]} stroke="white" strokeWidth={4} />
              <circle cx={0} cy={-13} r={14} fill="#FFDDB8" stroke="white" strokeWidth={4} />
              <path d="M-14,-15 a14,14 0 0 1 28,0 z" fill={GROUP_COLOR[group]} />
              <rect x={10} y={2} width={19} height={19} rx={4} fill="#2E7D32" stroke="white" strokeWidth={3} />
              <text x={19.5} y={17} textAnchor="middle" fontSize={12} fontWeight={900} fill="white">♻</text>
            </g>
          )}
        </svg>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" onClick={() => zoomAt(1.4)} className="w-10 h-10 rounded-xl bg-white/95 shadow font-black text-xl text-rtc-ink" aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomAt(1 / 1.4)} className="w-10 h-10 rounded-xl bg-white/95 shadow font-black text-xl text-rtc-ink" aria-label="Zoom out">−</button>
          {zoomed && <button type="button" onClick={() => setVb(FULL)} className="w-10 h-10 rounded-xl bg-white/95 shadow font-black text-sm text-rtc-ink" aria-label="Show whole campus">⤢</button>}
          {plan && plan.pts.length > 0 && (
            <button type="button" onClick={() => zoomTo(bounds(plan.pts), 1.25)} className="w-10 h-10 rounded-xl bg-white/95 shadow font-black text-base text-rtc-ink" aria-label="Zoom to the route" title="Zoom to the route">🔍</button>
          )}
        </div>

        {rename && (
          <RenamePopover rename={rename}
            style={{ left: `${((rename.at.x - vb.x) / vb.w) * 100}%`, top: `${((rename.at.y - vb.y) / vb.h) * 100}%` }}
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
                {walked <= 0 ? '🏠 Start at DA4'
                  : walked >= total ? '🏠 Back at DA4 — all done!'
                  : atStop ? `Stop ${stopNumber(atStop)}: ${atStop.label} · ${atStop.who}`
                  : current ? `Walking to ${current.label}…` : 'Walking home…'}
              </div>
              <button type="button" onClick={() => zoomTo(bounds(plan.pts), 1.25)} className="ml-auto text-sm font-bold text-rtc-gray underline">Zoom to route</button>
            </div>
            <input type="range" min={0} max={Math.max(1, Math.round(total))} value={Math.round(walked)}
              onChange={(e) => { setPlaying(false); setWalked(Number(e.target.value)); }}
              className="w-full h-4 cursor-pointer" style={{ accentColor: GROUP_COLOR[group] }} aria-label="Walk along the route" />
            <ol className="flex flex-wrap items-stretch gap-2">
              <Chip color={HOME_COLOR} ink="#4A3200" label="🏠 Start" sub="DA4" active={walked <= 0} />
              {plan.stops.map((s) => (
                <Chip key={s.signup.id} color={GROUP_COLOR[group]} ink="#fff" num={stopNumber(s)} label={s.label} sub={s.who}
                  active={atStop === s} done={s.at <= walked + 1}
                  onClick={() => { setPlaying(false); setWalked(s.at); zoomTo({ x: s.door.x - 150, y: s.door.y - 110, w: 300, h: 220 }, 1); }} />
              ))}
              <Chip color={HOME_COLOR} ink="#4A3200" label="🏠 Finish" sub="DA4" active={walked >= total} />
            </ol>
          </div>
        )
      )}

      <p className="text-sm text-rtc-gray font-bold">
        Scroll to zoom, drag to pan. Double-click any building or room to rename it.
        <span className="font-normal opacity-70"> · {AERIAL_CREDIT}</span>
      </p>
    </div>
  );
}

function Chip({ color, ink, num, label, sub, active, done, onClick }: {
  color: string; ink: string; num?: number; label: string; sub?: string; active?: boolean; done?: boolean; onClick?: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} disabled={!onClick}
        className={`flex items-center gap-2 rounded-2xl px-3 py-2 border-4 text-left ${active ? 'scale-105' : ''}`}
        style={{ background: done || active ? color : '#fff', color: done || active ? ink : '#6B7A87', borderColor: active ? '#1A2733' : color }}>
        {num !== undefined && (
          <span className="flex items-center justify-center w-9 h-9 rounded-full text-lg font-black shrink-0"
            style={{ background: done || active ? 'rgba(255,255,255,0.95)' : color, color: done || active ? color : '#fff' }}>{num}</span>
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
      style={{ ...style, marginTop: -8 }} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
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
