/**
 * Illustrated campus layout — a hand-placed overhead of North High traced
 * from the 2026/27 room map. Everything is in one 1600 × 1300 coordinate
 * space. Buildings are rounded footprints containing rows of room tiles;
 * sidewalks form a small network the pickup routes walk along.
 *
 * Nothing here is measured — it's a friendly cartoon, not a survey.
 */

export const MAP_W = 1600;
export const MAP_H = 1300;

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };

/** A tile in a row: a room (matches campus.ts room label), or empty space. */
export type Tile = { room: string | null; w?: number };
/** Rows top→bottom. 'corridor' draws a labeled hallway strip. */
export type Row = Tile[] | 'corridor';

export type BuildingLayout = {
  key: string;
  rect: Rect;
  rows: Row[];
  /** Roof / wall colours (pastel). */
  color: string;
  /** Where the sidewalk meets the building — must sit exactly on a sidewalk. */
  entrance: Pt;
  /** Optional flourish. */
  style?: 'gym' | 'cafeteria' | 'plain';
  /** Extra detached footprints drawn in the same colour (no tiles). */
  annex?: Array<{ rect: Rect; label?: string; rows?: Row[] }>;
  /** Optional path drawn from the room out to the entrance (inside the building). */
  doorPath?: Pt[];
  /** Draw as "location approximate". */
  approx?: boolean;
};

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const t = (room: string | null, w?: number): Tile => (w ? { room, w } : { room });

export const BUILDINGS: BuildingLayout[] = [
  /* ---------- Group A ---------- */
  {
    key: 'd-annex',
    color: '#F6C177',
    rect: R(136, 710, 334, 250),
    rows: [
      [t('DA10'), t(null, 4)],
      [t('DA8'), t('DA5'), t('DA3'), t('DA1'), t('History Work Room', 0.9)],
      'corridor',
      [t('DA6'), t('DA4', 1.4), t('DA2', 1.6), t(null, 0.9)],
    ],
    entrance: { x: 500, y: 869 },
  },
  {
    key: 'c-annex',
    color: '#F6C177',
    rect: R(136, 1010, 334, 150),
    rows: [
      [t('CA7'), t('CA5'), t('CA3'), t('CA1'), t('SPED Conference Room', 0.9)],
      'corridor',
      [t('CA8'), t('CA6'), t('CA4'), t('CA2'), t('English Work Room', 0.9)],
    ],
    entrance: { x: 500, y: 1085 },
  },
  {
    key: 'd-hall',
    color: '#F4A6A0',
    rect: R(570, 794, 440, 166),
    rows: [
      [t('D36'), t('D34'), t('D32'), t('D30'), t('D28'), t('D26'), t(null, 0.6)],
      'corridor',
      [t('D37'), t('D35'), t('D33'), t('D31'), t('D29'), t('D27'), t('Math Work Room', 0.6)],
    ],
    entrance: { x: 500, y: 877 },
  },
  {
    key: 'c-hall',
    color: '#F4A6A0',
    rect: R(530, 1092, 450, 70),
    rows: [[t('C17'), t('C15'), t('C13'), t('C11'), t('C9'), t('C7')]],
    entrance: { x: 500, y: 1127 },
  },
  {
    key: 'e-hall',
    color: '#C6A9E8',
    rect: R(570, 524, 440, 190),
    rows: [
      [t('E52'), t('E50', 1.6), t('E48'), t('E46', 1.6)],
      'corridor',
      [t('E55'), t('E53'), t('E51'), t('E49'), t('E47', 1.4)],
    ],
    entrance: { x: 500, y: 619 },
    annex: [
      {
        rect: R(356, 524, 74, 170),
        rows: [[t('E58')], [t('E57')], [t('E56')]],
      },
    ],
  },

  /* ---------- Group B ---------- */
  {
    key: 'learning-center',
    color: '#9AD0F5',
    rect: R(530, 1010, 214, 74),
    rows: [[t('Learning Center', 1.1), t('College & Career Center', 0.9)]],
    entrance: { x: 500, y: 1047 },
  },
  {
    key: 'library',
    color: '#9AD0F5',
    rect: R(752, 1010, 228, 74),
    rows: [[t('Library', 1.2), t('Textbooks & Duplicating', 0.8)]],
    entrance: { x: 866, y: 985 },
  },
  {
    key: 'admin',
    color: '#B8D8B0',
    rect: R(1024, 1010, 380, 130),
    rows: [
      [t('Room 6'), t('Room 5 (ASB)'), t('Room 4'), t('Room 3'), t('Room 2'), t('Title I / EL Office', 1.3)],
      [t('Admin Office')],
    ],
    entrance: { x: 1100, y: 985 },
  },
  {
    key: 'a-loft',
    color: '#9AD0F5',
    rect: R(320, 1190, 150, 70),
    rows: [[t('A Loft')]],
    entrance: { x: 500, y: 1225 },
    approx: true,
  },
  {
    key: 'gym',
    color: '#FFD98E',
    rect: R(250, 160, 226, 120),
    rows: [[t('Gym', 2.2), t('PE Office', 0.8)]],
    entrance: { x: 363, y: 316 },
    style: 'gym',
    annex: [{ rect: R(706, 184, 78, 92), rows: [[t('J1')]] }],
  },
  {
    key: 'trailers',
    color: '#CDE9A8',
    rect: R(136, 344, 334, 146),
    rows: [
      [t('T14'), t('T13'), t('T12'), t('T11')],
      'corridor',
      [t('T7'), t('T6'), t('T5'), t('T4')],
    ],
    entrance: { x: 500, y: 417 },
    annex: [
      {
        rect: R(530, 344, 250, 146),
        rows: [[t('T10'), t('T9 (SPED Offices)'), t('T8 (SPED Offices)')], 'corridor', [t('T3'), t('T2'), t('T1')]],
      },
    ],
  },
  {
    key: 'ia-quad',
    color: '#F9C6D8',
    rect: R(890, 76, 310, 222),
    rows: [
      [t('IA1'), t('IA7'), t('IA6')],
      [t('IA2'), t(null), t('IA5')],
      [t(null), t('IA3'), t('IA4 (ROC)')],
    ],
    entrance: { x: 1045, y: 316 },
  },
  {
    key: 'cafeteria',
    color: '#FFB98A',
    rect: R(980, 336, 220, 134),
    rows: [
      [t('Migrant / Y2L Office', 1.2), t(null, 0.8)],
      [t('Cafeteria')],
      [t('Speech-Language Pathology')],
    ],
    entrance: { x: 1090, y: 316 },
    style: 'cafeteria',
  },
  {
    key: 'oneill',
    color: '#B9E4D6',
    rect: R(1280, 136, 204, 174),
    rows: [[t('OH4'), t(null, 1.4), t('OH2 (Storage)')], 'corridor', [t(null, 2.4), t('OH3 (Office)')]],
    entrance: { x: 1240, y: 223 },
    annex: [
      { rect: R(1280, 360, 74, 120), rows: [[t('Band Room')]] },
      { rect: R(1400, 400, 84, 90), rows: [[t('Choir Room')]] },
    ],
  },
  {
    key: 'b-hall',
    color: '#B9E4D6',
    rect: R(1280, 550, 204, 410),
    rows: [
      [t('B68 (ISP)'), t(null, 0.5), t('B69')],
      [t('B70'), t(null, 0.5), t('B71')],
      [t('B72'), t(null, 0.5), t('B73 (OCI)')],
      [t('B74'), t(null, 0.5), t('B75 (PAC/PLUS)')],
      [t("Dean's Office"), t(null, 0.5), t('SAS Office')],
    ],
    entrance: { x: 1240, y: 700 },
  },
];

/** Home classroom DA4 and where its door meets the sidewalk. */
export const HOME = {
  building: 'd-annex',
  room: 'DA4',
  /** Sidewalk point where the D Annex hallway meets the path. */
  door: { x: 500, y: 869 },
  /** From inside DA4 out to the door (drawn as part of every route). */
  path: [{ x: 262, y: 905 }, { x: 262, y: 869 }, { x: 500, y: 869 }] as Pt[],
};

/* ---------- Sidewalk network ---------- */

export type Segment = { a: Pt; b: Pt };

export const SIDEWALKS: Segment[] = [
  // horizontal
  { a: { x: 136, y: 316 }, b: { x: 1560, y: 316 } },
  { a: { x: 500, y: 752 }, b: { x: 1560, y: 752 } },
  { a: { x: 500, y: 985 }, b: { x: 1560, y: 985 } },
  // vertical
  { a: { x: 500, y: 316 }, b: { x: 500, y: 1240 } },
  { a: { x: 1240, y: 60 }, b: { x: 1240, y: 985 } },
];

/* ---------- Decor ---------- */

export const QUAD: Rect = R(1080, 510, 140, 440);

export const TREES: Array<Pt & { r?: number }> = [
  // Quad
  { x: 1110, y: 560, r: 26 }, { x: 1200, y: 600, r: 22 }, { x: 1120, y: 880, r: 24 },
  { x: 1205, y: 920, r: 20 }, { x: 1150, y: 640, r: 18 },
  // around campus
  { x: 180, y: 560, r: 26 }, { x: 250, y: 620, r: 20 }, { x: 300, y: 560, r: 22 },
  { x: 800, y: 60, r: 22 }, { x: 860, y: 40, r: 18 },
  { x: 1520, y: 80, r: 24 }, { x: 1530, y: 560, r: 22 }, { x: 1520, y: 1080, r: 26 },
  { x: 60, y: 200, r: 24 }, { x: 60, y: 900, r: 22 }, { x: 60, y: 1250, r: 20 },
  { x: 900, y: 1240, r: 22 }, { x: 1300, y: 1240, r: 24 }, { x: 600, y: 1240, r: 20 },
  { x: 1400, y: 40, r: 18 }, { x: 250, y: 60, r: 26 }, { x: 560, y: 70, r: 20 },
  { x: 90, y: 600, r: 22 }, { x: 90, y: 1060, r: 20 }, 
  { x: 700, y: 1220, r: 24 }, { x: 1120, y: 1220, r: 20 }, 
];

export const FOUNTAIN: Pt = { x: 1155, y: 760 };

/* ---------- Geometry helpers ---------- */

/** Compute the tile rectangles for a building (or annex) from its rows. */
export function layoutTiles(
  rect: Rect,
  rows: Row[]
): Array<{ room: string; rect: Rect } | { corridor: true; rect: Rect }> {
  const pad = 10;
  const inner = R(rect.x + pad, rect.y + pad, rect.w - pad * 2, rect.h - pad * 2);
  const units = rows.reduce((n, r) => n + (r === 'corridor' ? 0.42 : 1), 0);
  const gap = 4;
  const rowH = (inner.h - gap * (rows.length - 1)) / units;
  const out: Array<{ room: string; rect: Rect } | { corridor: true; rect: Rect }> = [];
  let y = inner.y;
  for (const row of rows) {
    if (row === 'corridor') {
      const h = rowH * 0.42;
      out.push({ corridor: true, rect: R(inner.x, y, inner.w, h) });
      y += h + gap;
      continue;
    }
    const wUnits = row.reduce((n, tile) => n + (tile.w ?? 1), 0);
    const tileW = (inner.w - gap * (row.length - 1)) / wUnits;
    let x = inner.x;
    for (const tile of row) {
      const w = tileW * (tile.w ?? 1);
      if (tile.room) out.push({ room: tile.room, rect: R(x, y, w, rowH) });
      x += w + gap;
    }
    y += rowH + gap;
  }
  return out;
}

export function center(r: Rect): Pt {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Find the tile rect for a room anywhere in a building (main or annex). */
export function roomRect(b: BuildingLayout, room: string): Rect | null {
  for (const tile of layoutTiles(b.rect, b.rows)) {
    if ('room' in tile && tile.room === room) return tile.rect;
  }
  for (const a of b.annex ?? []) {
    if (!a.rows) continue;
    for (const tile of layoutTiles(a.rect, a.rows)) {
      if ('room' in tile && tile.room === room) return tile.rect;
    }
  }
  return null;
}

/* ---------- Routing along sidewalks ---------- */

function onSegment(p: Pt, s: Segment): boolean {
  const eps = 0.5;
  if (Math.abs(s.a.x - s.b.x) < eps) {
    return Math.abs(p.x - s.a.x) < eps && p.y >= Math.min(s.a.y, s.b.y) - eps && p.y <= Math.max(s.a.y, s.b.y) + eps;
  }
  return Math.abs(p.y - s.a.y) < eps && p.x >= Math.min(s.a.x, s.b.x) - eps && p.x <= Math.max(s.a.x, s.b.x) + eps;
}

function segIntersection(s1: Segment, s2: Segment): Pt | null {
  const v1 = Math.abs(s1.a.x - s1.b.x) < 0.5;
  const v2 = Math.abs(s2.a.x - s2.b.x) < 0.5;
  if (v1 === v2) return null;
  const v = v1 ? s1 : s2;
  const h = v1 ? s2 : s1;
  const p = { x: v.a.x, y: h.a.y };
  return onSegment(p, v) && onSegment(p, h) ? p : null;
}

const key = (p: Pt) => `${Math.round(p.x)},${Math.round(p.y)}`;

/**
 * Shortest walk along the sidewalks between two points that lie on them.
 * Returns the polyline (including both endpoints). Falls back to a straight
 * line if either point is off the network.
 */
export function routeAlongSidewalks(from: Pt, to: Pt): Pt[] {
  // Nodes: all segment endpoints, intersections, plus from/to.
  const nodes = new Map<string, Pt>();
  const add = (p: Pt) => nodes.set(key(p), p);
  for (const s of SIDEWALKS) {
    add(s.a);
    add(s.b);
  }
  for (let i = 0; i < SIDEWALKS.length; i++)
    for (let j = i + 1; j < SIDEWALKS.length; j++) {
      const p = segIntersection(SIDEWALKS[i], SIDEWALKS[j]);
      if (p) add(p);
    }
  const fromOn = SIDEWALKS.some((s) => onSegment(from, s));
  const toOn = SIDEWALKS.some((s) => onSegment(to, s));
  if (!fromOn || !toOn) return [from, to];
  add(from);
  add(to);

  // Edges: consecutive nodes along each segment.
  const adj = new Map<string, Array<{ k: string; d: number }>>();
  const link = (a: Pt, b: Pt) => {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    (adj.get(key(a)) ?? adj.set(key(a), []).get(key(a))!).push({ k: key(b), d });
    (adj.get(key(b)) ?? adj.set(key(b), []).get(key(b))!).push({ k: key(a), d });
  };
  for (const s of SIDEWALKS) {
    const on = [...nodes.values()].filter((p) => onSegment(p, s));
    on.sort((p, q) => (p.x - q.x) || (p.y - q.y));
    for (let i = 1; i < on.length; i++) link(on[i - 1], on[i]);
  }

  // Dijkstra
  const start = key(from);
  const goal = key(to);
  const dist = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, string>();
  const todo = new Set<string>([start]);
  while (todo.size) {
    let cur = '';
    let best = Infinity;
    for (const k of todo) {
      const d = dist.get(k) ?? Infinity;
      if (d < best) {
        best = d;
        cur = k;
      }
    }
    todo.delete(cur);
    if (cur === goal) break;
    for (const e of adj.get(cur) ?? []) {
      const nd = best + e.d;
      if (nd < (dist.get(e.k) ?? Infinity)) {
        dist.set(e.k, nd);
        prev.set(e.k, cur);
        todo.add(e.k);
      }
    }
  }
  if (!prev.has(goal) && start !== goal) return [from, to];
  const path: Pt[] = [];
  for (let k: string | undefined = goal; k; k = prev.get(k)) {
    path.push(nodes.get(k)!);
    if (k === start) break;
  }
  return path.reverse();
}

/** Total length of a polyline. */
export function polylineLength(pts: Pt[]): number {
  let n = 0;
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return n;
}

/** Point at fraction f (0..1) along a polyline. */
export function pointAlong(pts: Pt[], f: number): Pt {
  const total = polylineLength(pts);
  let target = total * Math.min(1, Math.max(0, f));
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (target <= seg || i === pts.length - 1) {
      const u = seg === 0 ? 0 : target / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u };
    }
    target -= seg;
  }
  return pts[pts.length - 1];
}

/**
 * Offset a polyline to the right of its direction of travel by `d`.
 * Out-and-back legs therefore land on opposite sides of the sidewalk, and
 * two groups sharing a sidewalk get parallel lanes instead of overlapping.
 */
export function offsetRight(pts: Pt[], d: number): Pt[] {
  const p = pts.filter((q, i) => i === 0 || Math.hypot(q.x - pts[i - 1].x, q.y - pts[i - 1].y) > 0.01);
  if (p.length < 2) return p;
  const segs = [] as Array<{ a: Pt; b: Pt; n: Pt }>;
  for (let i = 1; i < p.length; i++) {
    const dx = p[i].x - p[i - 1].x, dy = p[i].y - p[i - 1].y;
    const len = Math.hypot(dx, dy);
    const n = { x: -dy / len, y: dx / len }; // right-hand normal (screen coords)
    segs.push({ a: { x: p[i - 1].x + n.x * d, y: p[i - 1].y + n.y * d }, b: { x: p[i].x + n.x * d, y: p[i].y + n.y * d }, n });
  }
  const out: Pt[] = [segs[0].a];
  for (let i = 1; i < segs.length; i++) {
    const s1 = segs[i - 1], s2 = segs[i];
    const dot = s1.n.x * s2.n.x + s1.n.y * s2.n.y;
    if (dot < -0.99) {
      // U-turn: cap around the turnaround point
      out.push(s1.b, s2.a);
    } else if (dot > 0.99) {
      out.push(s2.a);
    } else {
      // intersect the two offset lines
      const x1 = s1.a.x, y1 = s1.a.y, x2 = s1.b.x, y2 = s1.b.y;
      const x3 = s2.a.x, y3 = s2.a.y, x4 = s2.b.x, y4 = s2.b.y;
      const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(den) < 1e-6) out.push(s2.a);
      else {
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        out.push({ x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) });
      }
    }
  }
  out.push(segs[segs.length - 1].b);
  return out;
}

/**
 * A walking loop around a building's footprint, starting and ending at the
 * point nearest `from`. Used when a group collects the building it already
 * lives in — otherwise that route would be a zero-length stub.
 */
export function perimeterLoop(rect: Rect, from: Pt, pad = 22): Pt[] {
  const x1 = rect.x - pad, y1 = rect.y - pad;
  const x2 = rect.x + rect.w + pad, y2 = rect.y + rect.h + pad;
  const corners: Pt[] = [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
  // start at the corner closest to the walker's entry point
  let start = 0, best = Infinity;
  corners.forEach((c, i) => {
    const d = Math.hypot(c.x - from.x, c.y - from.y);
    if (d < best) { best = d; start = i; }
  });
  const ordered = [...corners.slice(start), ...corners.slice(0, start)];
  return [...ordered, ordered[0]];
}
