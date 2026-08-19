/**
 * Illustrated campus layout for North High School, Bakersfield.
 *
 * Rooms come from the 2026/27 room map; the arrangement comes from satellite
 * imagery — athletic fields down the west side, gym and tennis courts north,
 * the classroom wings stepping through the middle, offices and admin east.
 * Kept square-on to the screen rather than rotated to true north: this gets
 * projected for the class, and level labels read far better from the back.
 *
 * Nothing here is measured. It is a friendly cartoon, not a survey.
 */

export const MAP_W = 2150;
export const MAP_H = 1340;

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };
export type Segment = { a: Pt; b: Pt };

/** A tile in a row: a room (matching campus.ts), or empty space. */
export type Tile = { room: string | null; w?: number };
/** Rows top to bottom. 'corridor' is the hallway students walk down. */
export type Row = Tile[] | 'corridor';

export type BuildingLayout = {
  key: string;
  rect: Rect;
  rows: Row[];
  color: string;
  /** Where the path meets the building — must sit on a sidewalk. */
  entrance: Pt;
  annex?: Array<{ rect: Rect; label?: string; rows?: Row[] }>;
  approx?: boolean;
  /** Force which side the walkway runs along (rooms in one row need this). */
  walkway?: 'top' | 'bottom' | 'left' | 'right';
  /** Drawn as an upper floor sitting on the building below it. */
  upstairs?: boolean;
};

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const t = (room: string | null, w?: number): Tile => (w ? { room, w } : { room });

export const BUILDINGS: BuildingLayout[] = [
  /* ---------- north ---------- */
  {
    key: 'gym',
    color: '#FFD98E',
    rect: R(830, 100, 250, 150),
    rows: [[t('Gym', 2.4), t('PE Office', 0.9)]],
    entrance: { x: 960, y: 310 },
    annex: [{ rect: R(1110, 130, 92, 92), rows: [[t('J1')]] }],
  },
  {
    key: 'ia-quad',
    color: '#F9C6D8',
    rect: R(1280, 90, 300, 210),
    rows: [
      [t('IA1'), t('IA7'), t('IA6')],
      [t('IA2'), t(null), t('IA5')],
      [t(null), t('IA3'), t('IA4 (ROC)')],
    ],
    entrance: { x: 1330, y: 310 },
  },
  {
    key: 'oneill',
    color: '#B9E4D6',
    rect: R(1650, 120, 220, 170),
    rows: [[t('OH4'), t(null, 1.3), t('OH2 (Storage)')], 'corridor', [t(null, 2.3), t('OH3 (Office)')]],
    entrance: { x: 1610, y: 205 },
    annex: [
      { rect: R(1650, 330, 92, 116), rows: [[t('Band Room')]] },
      { rect: R(1772, 330, 98, 116), rows: [[t('Choir Room')]] },
    ],
  },
  {
    key: 'trailers',
    color: '#CDE9A8',
    rect: R(540, 350, 400, 132),
    rows: [
      [t('T14'), t('T13'), t('T12'), t('T11'), t('T10'), t('T9 (SPED Offices)'), t('T8 (SPED Offices)')],
      'corridor',
      [t('T7'), t('T6'), t('T5'), t('T4'), t('T3'), t('T2'), t('T1')],
    ],
    entrance: { x: 960, y: 416 },
  },
  {
    key: 'cafeteria',
    color: '#FFB98A',
    rect: R(1280, 350, 240, 132),
    rows: [[t('Migrant / Y2L Office')], [t('Cafeteria')], [t('Speech-Language Pathology')]],
    entrance: { x: 1400, y: 310 },
  },

  /* ---------- the classroom wings ---------- */
  {
    key: 'e-hall',
    color: '#C6A9E8',
    rect: R(1020, 540, 420, 165),
    rows: [
      [t('E52'), t('E50', 1.5), t('E48'), t('E46', 1.5)],
      'corridor',
      [t('E55'), t('E53'), t('E51'), t('E49'), t('E47', 1.3)],
    ],
    entrance: { x: 960, y: 622 },
    annex: [{ rect: R(820, 545, 92, 155), rows: [[t('E58')], [t('E57')], [t('E56')]] }],
  },
  {
    key: 'd-annex',
    color: '#F6C177',
    rect: R(540, 700, 340, 250),
    rows: [
      [t('DA10'), t(null, 4)],
      [t('DA8'), t('DA5'), t('DA3'), t('DA1'), t('History Work Room', 0.9)],
      'corridor',
      [t('DA6'), t('DA4', 1.4), t('DA2', 1.6), t(null, 0.9)],
    ],
    entrance: { x: 960, y: 859 },
  },
  {
    key: 'd-hall',
    color: '#F4A6A0',
    rect: R(1020, 790, 420, 165),
    rows: [
      [t('D36'), t('D34'), t('D32'), t('D30'), t('D28'), t('D26'), t(null, 0.6)],
      'corridor',
      [t('D37'), t('D35'), t('D33'), t('D31'), t('D29'), t('D27'), t('Math Work Room', 0.6)],
    ],
    entrance: { x: 960, y: 872 },
  },
  {
    key: 'b-hall',
    color: '#B9E4D6',
    rect: R(1650, 540, 210, 360),
    rows: [
      [t('B68 (ISP)'), t(null, 0.4), t('B69')],
      [t('B70'), t(null, 0.4), t('B71')],
      [t('B72'), t(null, 0.4), t('B73 (OCI)')],
      [t('B74'), t(null, 0.4), t('B75 (PAC/PLUS)')],
      [t("Dean's Office"), t(null, 0.4), t('SAS Office')],
    ],
    entrance: { x: 1610, y: 720 },
  },

  /* ---------- south ---------- */
  {
    key: 'learning-center',
    color: '#9AD0F5',
    rect: R(1040, 980, 200, 72),
    rows: [[t('Learning Center'), t('College & Career Center')]],
    entrance: { x: 960, y: 1016 },
  },
  {
    key: 'library',
    color: '#9AD0F5',
    rect: R(1270, 980, 220, 72),
    rows: [[t('Library'), t('Textbooks & Duplicating')]],
    entrance: { x: 1380, y: 970 },
  },
  {
    key: 'c-annex',
    color: '#F6C177',
    rect: R(560, 1010, 340, 150),
    rows: [
      [t('CA7'), t('CA5'), t('CA3'), t('CA1'), t('SPED Conference Room', 0.9)],
      'corridor',
      [t('CA8'), t('CA6'), t('CA4'), t('CA2'), t('English Work Room', 0.9)],
    ],
    entrance: { x: 960, y: 1085 },
  },
  {
    key: 'c-hall',
    color: '#F4A6A0',
    rect: R(1040, 1082, 440, 78),
    rows: [[t('C17'), t('C15'), t('C13'), t('C11'), t('C9'), t('C7')]],
    entrance: { x: 960, y: 1121 },
  },
  {
    key: 'admin',
    color: '#B8D8B0',
    rect: R(1650, 1092, 400, 108),
    rows: [[t('Admin Office')]],
    entrance: { x: 1610, y: 1146 },
    walkway: 'left',
  },
  {
    // Upstairs of the Admin building: a row of classrooms facing the quad.
    key: 'a-loft',
    color: '#9AD0F5',
    rect: R(1650, 960, 400, 112),
    rows: [[t('Room 6 (ASB)'), t('Room 5 (ASB)'), t('Room 4'), t('Room 3'), t('Room 2'), t('Room 1 (Title I / EL)', 1.4)]],
    entrance: { x: 1610, y: 1016 },
    walkway: 'top',
    upstairs: true,
  },
];

/** Home classroom DA4 — every walk starts and ends here. */
export const HOME = {
  building: 'd-annex',
  room: 'DA4',
  /** Where the D Annex hallway meets the sidewalk. */
  door: { x: 960, y: 859 } as Pt,
  /** Out of DA4, into the hall, and out to the path. */
  path: [{ x: 661, y: 908 }, { x: 661, y: 859 }, { x: 960, y: 859 }] as Pt[],
};

/* ---------- sidewalks ---------- */

export const SIDEWALKS: Segment[] = [
  { a: { x: 960, y: 250 }, b: { x: 960, y: 1270 } },   // main spine
  { a: { x: 1610, y: 180 }, b: { x: 1610, y: 1230 } }, // east spine
  { a: { x: 540, y: 310 }, b: { x: 1610, y: 310 } },
  { a: { x: 960, y: 500 }, b: { x: 1610, y: 500 } },
  { a: { x: 960, y: 740 }, b: { x: 1610, y: 740 } },
  { a: { x: 540, y: 970 }, b: { x: 1610, y: 970 } },
  { a: { x: 960, y: 1190 }, b: { x: 1610, y: 1190 } },
  { a: { x: 1610, y: 500 }, b: { x: 1900, y: 500 } },
];

/* ---------- landmarks (scenery only) ---------- */

export type Landmark = {
  kind: 'track' | 'diamond' | 'tennis' | 'pool' | 'parking' | 'amphitheatre' | 'quad';
  rect: Rect;
  label: string;
};

export const LANDMARKS: Landmark[] = [
  { kind: 'track', rect: R(40, 70, 350, 240), label: 'Athletic Field' },
  { kind: 'diamond', rect: R(40, 360, 350, 250), label: 'Baseball' },
  { kind: 'diamond', rect: R(40, 660, 350, 240), label: 'Softball' },
  { kind: 'pool', rect: R(60, 950, 310, 120), label: 'Pool' },
  { kind: 'tennis', rect: R(1900, 60, 230, 160), label: 'Tennis' },
  { kind: 'parking', rect: R(1900, 300, 220, 200), label: 'Parking' },
  { kind: 'amphitheatre', rect: R(1900, 590, 220, 180), label: 'Amphitheatre' },
  { kind: 'parking', rect: R(1300, 1215, 420, 100), label: 'Parking' },
  { kind: 'quad', rect: R(1480, 540, 110, 410), label: 'Quad' },
];

export const QUAD: Rect = R(1480, 540, 110, 410);
export const FOUNTAIN: Pt = { x: 1535, y: 745 };

export const TREES: Array<Pt & { r?: number }> = [
  { x: 1510, y: 590, r: 24 }, { x: 1560, y: 650, r: 19 }, { x: 1515, y: 890, r: 22 },
  { x: 1555, y: 830, r: 17 },
  { x: 470, y: 1180, r: 24 }, { x: 700, y: 620, r: 26 }, { x: 480, y: 560, r: 20 },
  { x: 1160, y: 320, r: 20 }, { x: 1230, y: 250, r: 24 }, { x: 700, y: 250, r: 22 },
  { x: 2000, y: 850, r: 26 }, { x: 2100, y: 890, r: 22 },
  { x: 780, y: 1240, r: 22 }, { x: 1260, y: 1130, r: 20 }, { x: 1560, y: 1240, r: 22 },
  { x: 920, y: 60, r: 20 }, { x: 1360, y: 1130, r: 24 }, { x: 660, y: 1000, r: 0 },
  { x: 2060, y: 560, r: 20 }, { x: 1180, y: 1240, r: 22 }, { x: 430, y: 1290, r: 24 },
];

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

/* ---------- walking inside a building ---------- */

export type Part = { rect: Rect; rows: Row[] };

/** Every footprint of a building that has rooms in it. */
export function buildingParts(b: BuildingLayout): Part[] {
  return [
    { rect: b.rect, rows: b.rows },
    ...(b.annex ?? []).filter((a) => a.rows).map((a) => ({ rect: a.rect, rows: a.rows! })),
  ];
}

/** The hallway line students actually walk down inside a part. */
export function partSpine(part: Part, entrance: Pt, walkway?: 'top' | 'bottom' | 'left' | 'right'): Segment {
  const corridor = layoutTiles(part.rect, part.rows).find((t) => 'corridor' in t) as
    | { corridor: true; rect: Rect }
    | undefined;
  if (corridor) {
    const c = corridor.rect;
    return { a: { x: c.x + 8, y: c.y + c.h / 2 }, b: { x: c.x + c.w - 8, y: c.y + c.h / 2 } };
  }
  // No interior hallway: walk along the outside edge facing the entrance.
  const r = part.rect;
  const pad = 30;
  const d = {
    top: Math.abs(entrance.y - r.y),
    bottom: Math.abs(entrance.y - (r.y + r.h)),
    left: Math.abs(entrance.x - r.x),
    right: Math.abs(entrance.x - (r.x + r.w)),
  };
  const nearest = walkway ?? (Object.keys(d) as Array<keyof typeof d>).reduce((a, b) => (d[a] <= d[b] ? a : b));
  if (nearest === 'top') return { a: { x: r.x + 14, y: r.y - pad }, b: { x: r.x + r.w - 14, y: r.y - pad } };
  if (nearest === 'bottom') return { a: { x: r.x + 14, y: r.y + r.h + pad }, b: { x: r.x + r.w - 14, y: r.y + r.h + pad } };
  if (nearest === 'left') return { a: { x: r.x - pad, y: r.y + 14 }, b: { x: r.x - pad, y: r.y + r.h - 14 } };
  return { a: { x: r.x + r.w + pad, y: r.y + 14 }, b: { x: r.x + r.w + pad, y: r.y + r.h - 14 } };
}

export function isHorizontal(s: Segment): boolean {
  return Math.abs(s.a.y - s.b.y) < 0.5;
}

/** Closest point on an axis-aligned segment. */
export function projectOnSegment(p: Pt, s: Segment): Pt {
  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  return isHorizontal(s)
    ? { x: clamp(p.x, s.a.x, s.b.x), y: s.a.y }
    : { x: s.a.x, y: clamp(p.y, s.a.y, s.b.y) };
}

/** A room's doorway (on the wall facing the hall) and the hall point outside it. */
export function roomDoor(room: Rect, spine: Segment): { door: Pt; hall: Pt } {
  const c = center(room);
  const hall = projectOnSegment(c, spine);
  const door = isHorizontal(spine)
    ? { x: hall.x, y: hall.y > c.y ? room.y + room.h - 8 : room.y + 8 }
    : { y: hall.y, x: hall.x > c.x ? room.x + room.w - 8 : room.x + 8 };
  return { door, hall };
}

/** Which end of the hallway you come in through. */
export function spineEntry(spine: Segment, from: Pt): Pt {
  return Math.hypot(spine.a.x - from.x, spine.a.y - from.y) <=
    Math.hypot(spine.b.x - from.x, spine.b.y - from.y)
    ? spine.a
    : spine.b;
}

/** Running distance to each point of a polyline. */
export function cumulative(pts: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) {
    out.push(out[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return out;
}

/** Point at a given distance along a polyline. */
export function pointAtDistance(pts: Pt[], dist: number): Pt {
  const cum = cumulative(pts);
  const total = cum[cum.length - 1];
  const d = Math.min(Math.max(dist, 0), total);
  for (let i = 1; i < pts.length; i++) {
    if (d <= cum[i]) {
      const seg = cum[i] - cum[i - 1];
      const u = seg === 0 ? 0 : (d - cum[i - 1]) / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u };
    }
  }
  return pts[pts.length - 1];
}
