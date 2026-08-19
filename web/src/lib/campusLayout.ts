/**
 * Campus layout for North High School, Bakersfield — traced from an aerial
 * photo of the school (web/public/campus-aerial.jpg, 2000 × 1510).
 *
 * Every building outline below was traced off the photo, so shapes sit where
 * they really are and look the way they really look (B Hall tilts, the
 * cafeteria has its cut corner, Admin has its rotunda). Inside each building,
 * a room "frame" — a possibly rotated rectangle — carries the room tiles from
 * the 2026/27 room map, so the schematic still helps identify rooms.
 * Sidewalks follow the real walkways, diagonals and all.
 *
 * Nothing here is surveyed; it is traced by eye to a few pixels.
 */

export const MAP_W = 2000;
export const MAP_H = 1510;
export const AERIAL_SRC = '/campus-aerial.jpg';
export const AERIAL_CREDIT = 'Aerial imagery © Esri, Maxar, Earthstar Geographics';

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };
export type Segment = { a: Pt; b: Pt };

/** A tile in a row: a room (matching campus.ts), or empty space. */
export type Tile = { room: string | null; w?: number };
/** Rows top to bottom. 'corridor' is the hallway students walk down. */
export type Row = Tile[] | 'corridor';

/** A rectangle of room tiles, optionally rotated about its centre (degrees, clockwise). */
export type Frame = { rect: Rect; rows: Row[]; angle?: number };

export type BuildingLayout = {
  key: string;
  color: string;
  /** Traced footprint (world coords). */
  outline: Pt[];
  /** Room frames — the main one first; extra detached parts after. */
  frames: Frame[];
  /** Where the sidewalk meets the building — snapped onto the nearest walkway. */
  entrance: Pt;
  /** Where the hallway opens to the outside, if not simply the spine end. */
  door?: Pt;
  /** Which side of the main frame the walkway runs along (frames without a corridor row). */
  walkway?: 'top' | 'bottom' | 'left' | 'right';
  /** Explicit hallway line in the main frame's LOCAL (unrotated) coords. */
  spine?: Segment;
  upstairs?: boolean;
  nameplate?: 'top' | 'bottom' | 'left' | 'right' | 'none';
  /** Where to hang the name plate, if not on the frame's bounding box. */
  nameAt?: Pt;
};

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });
const t = (room: string | null, w?: number): Tile => (w ? { room, w } : { room });
const P = (x: number, y: number): Pt => ({ x, y });
const rectPoly = (r: Rect): Pt[] => [P(r.x, r.y), P(r.x + r.w, r.y), P(r.x + r.w, r.y + r.h), P(r.x, r.y + r.h)];

export const BUILDINGS: BuildingLayout[] = [
  /* ---------- north ---------- */
  {
    key: 'gym',
    color: '#FFD98E',
    // Red-roofed main gym with its rounded west entrance and the low PE annex.
    outline: [
      P(923, 105), P(897, 123), P(883, 157), P(880, 185), P(883, 214), P(897, 247), P(923, 271),
      P(897, 271), P(897, 347), P(1097, 347), P(1097, 266), P(1173, 266), P(1173, 135), P(1092, 135),
      P(1092, 119), P(923, 119),
    ],
    frames: [
      { rect: R(905, 125, 262, 210), rows: [[t('Gym', 2.5), t('PE Office', 0.9)]] },
      { rect: R(1097, 219, 76, 47), rows: [[t('J1')]] },
    ],
    entrance: P(1000, 372),
    door: P(1000, 349),
    walkway: 'bottom',
    nameplate: 'top',
  },
  {
    key: 'ia-quad',
    color: '#F9C6D8',
    // An L of shops around a work yard, plus the long east shop building.
    outline: [
      P(1353, 349), P(1425, 349), P(1425, 330), P(1594, 330), P(1594, 392), P(1600, 392),
      P(1600, 392), P(1669, 392), P(1669, 560), P(1600, 560), P(1600, 442), P(1487, 442),
      P(1487, 517), P(1353, 517),
    ],
    frames: [
      {
        rect: R(1356, 336, 310, 220),
        rows: [
          [t('IA1'), t('IA7'), t('IA6')],
          [t('IA2'), t(null), t('IA5')],
          [t(null), t('IA3'), t('IA4 (ROC)')],
        ],
      },
    ],
    entrance: P(1300, 440),
    door: P(1353, 440),
    walkway: 'left',
    nameplate: 'top',
  },
  {
    key: 'oneill',
    color: '#B9E4D6',
    outline: [P(1677, 545), P(1896, 545), P(1896, 645), P(1677, 645)],
    frames: [
      { rect: R(1681, 549, 211, 92), rows: [[t('OH4'), t('OH2 (Storage)')], 'corridor', [t('OH3 (Office)'), t('Band Room'), t('Choir Room')]] },
    ],
    entrance: P(1650, 620),
    door: P(1677, 596),
    nameplate: 'top',
  },
  {
    key: 'cafeteria',
    color: '#FFB98A',
    // Big multipurpose building with the slanted south face.
    outline: [P(1358, 596), P(1531, 596), P(1531, 630), P(1585, 636), P(1622, 679), P(1622, 743), P(1354, 675)],
    frames: [
      { rect: R(1362, 600, 220, 118), rows: [[t('Migrant / Y2L Office')], [t('Cafeteria')], [t('Speech-Language Pathology')]] },
    ],
    entrance: P(1342, 556),
    door: P(1358, 620),
    walkway: 'left',
    nameplate: 'top',
  },
  {
    key: 'trailers',
    color: '#CDE9A8',
    // Portables: seven modules in the long row (two rooms each), three in the short row.
    outline: [P(615, 768), P(827, 768), P(827, 824), P(615, 824)],
    frames: [
      {
        rect: R(615, 768, 212, 56),
        rows: [
          [t('T14'), t('T13'), t('T12'), t('T11'), t('T10'), t('T9 (SPED Offices)'), t('T8 (SPED Offices)')],
          'corridor',
          [t('T7'), t('T6'), t('T5'), t('T4'), t('T3'), t('T2'), t('T1')],
        ],
      },
    ],
    entrance: P(830, 753),
    door: P(832, 796),
    nameplate: 'top',
    nameAt: P(721, 748),
  },

  /* ---------- the classroom wings ---------- */
  {
    key: 'e-hall',
    color: '#C6A9E8',
    outline: [P(946, 758), P(1202, 758), P(1202, 844), P(946, 844)],
    frames: [
      {
        rect: R(946, 758, 256, 86),
        rows: [
          [t('E52'), t('E50', 1.5), t('E48'), t('E46', 1.5)],
          'corridor',
          [t('E55'), t('E53'), t('E51'), t('E49'), t('E47', 1.3)],
        ],
      },
      { rect: R(857, 790, 53, 90), rows: [[t('E58')], [t('E57')], [t('E56')]] },
    ],
    entrance: P(935, 801),
    nameplate: 'right',
  },
  {
    key: 'd-annex',
    color: '#F6C177',
    // The little notch at top-left is DA10.
    outline: [P(743, 865), P(782, 865), P(782, 883), P(900, 883), P(900, 965), P(743, 965)],
    frames: [
      {
        rect: R(743, 865, 157, 100),
        rows: [
          [t('DA10'), t('DA8'), t('DA5'), t('DA3'), t('DA1'), t('History Work Room', 0.9)],
          'corridor',
          [t('DA6'), t('DA4', 1.4), t('DA2', 1.6), t(null, 0.9)],
        ],
      },
    ],
    entrance: P(935, 915),
    nameplate: 'left',
  },
  {
    key: 'd-hall',
    color: '#F4A6A0',
    outline: [P(946, 884), P(1202, 884), P(1202, 964), P(946, 964)],
    frames: [
      {
        rect: R(946, 884, 256, 80),
        rows: [
          [t('D36'), t('D34'), t('D32'), t('D30'), t('D28'), t('D26'), t(null, 0.6)],
          'corridor',
          [t('D37'), t('D35'), t('D33'), t('D31'), t('D29'), t('D27'), t('Math Work Room', 0.6)],
        ],
      },
    ],
    entrance: P(935, 924),
    nameplate: 'right',
  },
  {
    key: 'b-hall',
    color: '#B9E4D6',
    // The tilted office bar along the east side of the quad.
    outline: [P(1622, 825), P(1681, 825), P(1604, 1014), P(1538, 998)],
    frames: [
      {
        rect: R(1580, 817, 62, 196),
        angle: 24,
        rows: [
          [t('B68 (ISP)'), t(null, 0.4), t('B69')],
          [t('B70'), t(null, 0.4), t('B71')],
          [t('B72'), t(null, 0.4), t('B73 (OCI)')],
          [t('B74'), t(null, 0.4), t('B75 (PAC/PLUS)')],
          [t("Dean's Office"), t(null, 0.4), t('SAS Office')],
        ],
      },
    ],
    entrance: P(1579, 823),
    door: P(1651, 826),
    spine: { a: P(1611, 826), b: P(1611, 1004) },
    nameplate: 'right',
  },

  /* ---------- south ---------- */
  {
    key: 'learning-center',
    color: '#9AD0F5',
    outline: [P(947, 999), P(1072, 999), P(1072, 1055), P(947, 1055)],
    frames: [{ rect: R(947, 999, 125, 56), rows: [[t('Learning Center'), t('College & Career Center')]] }],
    entrance: P(935, 1055),
    walkway: 'bottom',
    nameplate: 'none',
  },
  {
    key: 'library',
    color: '#9AD0F5',
    outline: [P(1072, 999), P(1197, 999), P(1197, 1055), P(1072, 1055)],
    frames: [{ rect: R(1072, 999, 125, 56), rows: [[t('Library'), t('Textbooks & Duplicating')]] }],
    entrance: P(1213, 1055),
    walkway: 'bottom',
    nameplate: 'none',
  },
  {
    key: 'c-hall',
    color: '#F4A6A0',
    outline: [P(947, 1055), P(1197, 1055), P(1197, 1092), P(947, 1092)],
    frames: [{ rect: R(947, 1055, 250, 37), rows: [[t('C17'), t('C15'), t('C13'), t('C11'), t('C9'), t('C7')]] }],
    entrance: P(935, 1055),
    walkway: 'top',
    nameplate: 'bottom',
  },
  {
    key: 'c-annex',
    color: '#F6C177',
    outline: [P(750, 1017), P(900, 1017), P(900, 1093), P(750, 1093)],
    frames: [
      {
        rect: R(750, 1017, 150, 76),
        rows: [
          [t('CA7'), t('CA5'), t('CA3'), t('CA1'), t('SPED Conference Room', 0.9)],
          'corridor',
          [t('CA8'), t('CA6'), t('CA4'), t('CA2'), t('English Work Room', 0.9)],
        ],
      },
    ],
    entrance: P(935, 1055),
    nameplate: 'left',
  },
  {
    key: 'admin',
    color: '#B8D8B0',
    // Long admin bar with the rotunda on its south side.
    outline: [
      P(1225, 992), P(1587, 992), P(1587, 1042), P(1400, 1042),
      P(1392, 1062), P(1372, 1077), P(1350, 1084), P(1331, 1086), P(1312, 1084), P(1290, 1077), P(1270, 1062), P(1262, 1042),
      P(1225, 1042),
    ],
    frames: [{ rect: R(1229, 996, 354, 42), rows: [[t('Admin Office')]] }],
    entrance: P(1331, 1130),
    door: P(1331, 1086),
    walkway: 'bottom',
    nameplate: 'bottom',
    nameAt: P(1500, 1105),
  },
  {
    // Upstairs of Admin — a row of classrooms along the quad side.
    key: 'a-loft',
    color: '#9AD0F5',
    outline: [P(1229, 972), P(1583, 972), P(1583, 1000), P(1229, 1000)],
    frames: [
      { rect: R(1229, 972, 354, 28), rows: [[t('Room 6 (ASB)'), t('Room 5 (ASB)'), t('Room 4'), t('Room 3'), t('Room 2'), t('Room 1 (Title I / EL)', 1.3)]] },
    ],
    entrance: P(1400, 990),
    walkway: 'top',
    upstairs: true,
    nameplate: 'left',
    nameAt: P(1180, 986),
  },
];

/** Home classroom DA4 — every walk starts and ends here. */
export const HOME = { building: 'd-annex', room: 'DA4' };

/* ---------- sidewalks, traced from the real walkways ---------- */

export const SIDEWALKS: Segment[] = [
  { a: P(850, 372), b: P(1300, 372) },     // north walk, south of the gym
  { a: P(1300, 372), b: P(1300, 551) },    // down the west side of IA Quad
  { a: P(852, 372), b: P(852, 753) },      // between the courts and the small gym
  { a: P(615, 753), b: P(1213, 753) },     // trailers → north of E Hall
  { a: P(935, 753), b: P(935, 1130) },     // west of the wings (main N–S)
  { a: P(1102, 540), b: P(1342, 556) },    // plaza: small gym → cafeteria
  { a: P(1245, 540), b: P(1245, 760) },    // plaza N–S
  { a: P(1094, 652), b: P(1245, 738) },    // diagonal from the small gym to the plaza
  { a: P(1213, 753), b: P(1245, 760) },    // plaza connector
  { a: P(1245, 760), b: P(1622, 760) },    // south of the cafeteria
  { a: P(1213, 753), b: P(1213, 1130) },   // east of the wings, along the quad
  { a: P(1213, 790), b: P(1400, 790) },    // north edge of the quad
  { a: P(1400, 790), b: P(1525, 990) },    // diagonal across the quad
  { a: P(1213, 990), b: P(1525, 990) },    // quad side of Admin / the loft
  { a: P(1525, 990), b: P(1600, 760) },    // along the west face of B Hall
  { a: P(1622, 760), b: P(1650, 620) },    // up to O'Neill Hall
  { a: P(935, 1130), b: P(1620, 1130) },   // south walk, above the parking
];

/* ---------- other traced shapes, for orientation only ---------- */

export type Extra = { outline: Pt[]; label?: string; kind?: 'building' | 'court' | 'seating' };
export const EXTRAS: Extra[] = [
  {
    // Barrel-roofed small gym, tilted, with its low west annex.
    label: 'Small Gym',
    kind: 'building',
    outline: [P(940, 480), P(1063, 530), P(1083, 547), P(1093, 573), P(1077, 600), P(1047, 612), P(993, 673), P(857, 627), P(897, 563), P(900, 530)],
  },
  { kind: 'building', outline: [P(1110, 428), P(1198, 428), P(1198, 452), P(1270, 452), P(1270, 540), P(1110, 540)] },
  { kind: 'building', outline: [P(1262, 606), P(1304, 606), P(1304, 640), P(1262, 640)] },
  { kind: 'building', outline: [P(615, 705), P(701, 705), P(701, 750), P(615, 750)] },
  { kind: 'building', outline: [P(755, 500), P(825, 500), P(825, 528), P(755, 528)] },
  { kind: 'court', label: 'Basketball Courts', outline: rectPoly(R(615, 500, 235, 200)) },
  {
    kind: 'seating',
    label: 'Amphitheatre',
    outline: [P(1677, 652), P(1792, 652), P(1838, 790), P(1800, 806), P(1735, 812), P(1670, 806), P(1631, 790)],
  },
];

export type Landmark = { at: Pt; label: string };
export const LANDMARKS: Landmark[] = [
  { at: P(450, 275), label: 'Football Field' },
  { at: P(1810, 210), label: 'Tennis Courts' },
  { at: P(400, 640), label: 'Baseball' },
  { at: P(230, 1010), label: 'Softball' },
  { at: P(660, 1020), label: 'Softball' },
  { at: P(1420, 870), label: 'Quad' },
  { at: P(1390, 1300), label: 'Parking' },
  { at: P(1810, 1140), label: 'Practice Field' },
  { at: P(1545, 440), label: 'IA Yard' },
];

/* ---------- Geometry helpers ---------- */

export function center(r: Rect): Pt {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Rotate a point about a centre by degrees (clockwise on screen). */
export function rotatePt(p: Pt, c: Pt, deg: number): Pt {
  if (!deg) return p;
  const a = (deg * Math.PI) / 180;
  const dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Frame-local point → world. */
export function toWorld(p: Pt, f: Frame): Pt {
  return rotatePt(p, center(f.rect), f.angle ?? 0);
}

/** World point → frame-local. */
export function toLocal(p: Pt, f: Frame): Pt {
  return rotatePt(p, center(f.rect), -(f.angle ?? 0));
}

/** Compute the tile rectangles (frame-local coords) for a frame's rows. */
export function layoutTiles(
  rect: Rect,
  rows: Row[]
): Array<{ room: string; rect: Rect } | { corridor: true; rect: Rect }> {
  const pad = Math.min(8, rect.h * 0.08);
  const inner = { x: rect.x + pad, y: rect.y + pad, w: rect.w - pad * 2, h: rect.h - pad * 2 };
  const units = rows.reduce((n, r) => n + (r === 'corridor' ? 0.42 : 1), 0);
  const gap = 3;
  const rowH = (inner.h - gap * (rows.length - 1)) / units;
  const out: Array<{ room: string; rect: Rect } | { corridor: true; rect: Rect }> = [];
  let y = inner.y;
  for (const row of rows) {
    if (row === 'corridor') {
      const h = rowH * 0.42;
      out.push({ corridor: true, rect: { x: inner.x, y, w: inner.w, h } });
      y += h + gap;
      continue;
    }
    const wUnits = row.reduce((n, tile) => n + (tile.w ?? 1), 0);
    const tileW = (inner.w - gap * (row.length - 1)) / wUnits;
    let x = inner.x;
    for (const tile of row) {
      const w = tileW * (tile.w ?? 1);
      if (tile.room) out.push({ room: tile.room, rect: { x, y, w, h: rowH } });
      x += w + gap;
    }
    y += rowH + gap;
  }
  return out;
}

/** Find the frame + local tile rect for a room anywhere in a building. */
export function findRoom(b: BuildingLayout, room: string): { frame: Frame; rect: Rect } | null {
  for (const frame of b.frames) {
    for (const tile of layoutTiles(frame.rect, frame.rows)) {
      if ('room' in tile && tile.room === room) return { frame, rect: tile.rect };
    }
  }
  return null;
}

/** World-space centre of a room tile. */
export function roomCenterWorld(b: BuildingLayout, room: string): Pt | null {
  const f = findRoom(b, room);
  return f ? toWorld(center(f.rect), f.frame) : null;
}

/* ---------- walking inside a building (frame-local) ---------- */

/** The hallway line students walk down inside a frame (local coords). */
export function frameSpine(
  frame: Frame,
  entranceLocal: Pt,
  walkway?: 'top' | 'bottom' | 'left' | 'right',
  override?: Segment
): Segment {
  if (override) return override;
  const corridor = layoutTiles(frame.rect, frame.rows).find((t) => 'corridor' in t) as
    | { corridor: true; rect: Rect }
    | undefined;
  if (corridor) {
    const c = corridor.rect;
    return { a: { x: c.x + 6, y: c.y + c.h / 2 }, b: { x: c.x + c.w - 6, y: c.y + c.h / 2 } };
  }
  const r = frame.rect;
  const pad = 22;
  const d = {
    top: Math.abs(entranceLocal.y - r.y),
    bottom: Math.abs(entranceLocal.y - (r.y + r.h)),
    left: Math.abs(entranceLocal.x - r.x),
    right: Math.abs(entranceLocal.x - (r.x + r.w)),
  };
  const side = walkway ?? (Object.keys(d) as Array<keyof typeof d>).reduce((a, b) => (d[a] <= d[b] ? a : b));
  if (side === 'top') return { a: { x: r.x + 10, y: r.y - pad }, b: { x: r.x + r.w - 10, y: r.y - pad } };
  if (side === 'bottom') return { a: { x: r.x + 10, y: r.y + r.h + pad }, b: { x: r.x + r.w - 10, y: r.y + r.h + pad } };
  if (side === 'left') return { a: { x: r.x - pad, y: r.y + 10 }, b: { x: r.x - pad, y: r.y + r.h - 10 } };
  return { a: { x: r.x + r.w + pad, y: r.y + 10 }, b: { x: r.x + r.w + pad, y: r.y + r.h - 10 } };
}

function isHorizontalSeg(s: Segment): boolean {
  return Math.abs(s.a.y - s.b.y) < 0.5;
}

/** Closest point on an axis-aligned local segment. */
function projectAxis(p: Pt, s: Segment): Pt {
  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  return isHorizontalSeg(s) ? { x: clamp(p.x, s.a.x, s.b.x), y: s.a.y } : { x: s.a.x, y: clamp(p.y, s.a.y, s.b.y) };
}

/** A room's doorway (on the wall facing the hall) and the hall point outside it — local coords. */
export function roomDoorLocal(room: Rect, spine: Segment): { door: Pt; hall: Pt } {
  const c = center(room);
  const hall = projectAxis(c, spine);
  const door = isHorizontalSeg(spine)
    ? { x: hall.x, y: hall.y > c.y ? room.y + room.h - 5 : room.y + 5 }
    : { y: hall.y, x: hall.x > c.x ? room.x + room.w - 5 : room.x + 5 };
  return { door, hall };
}

/** Which end of the hallway you come in through (world coords). */
export function nearerEnd(spineWorld: Segment, from: Pt): Pt {
  return Math.hypot(spineWorld.a.x - from.x, spineWorld.a.y - from.y) <=
    Math.hypot(spineWorld.b.x - from.x, spineWorld.b.y - from.y)
    ? spineWorld.a
    : spineWorld.b;
}

/* ---------- routing along the sidewalks (any angle) ---------- */

const EPS = 0.75;

function distToSegment(p: Pt, s: Segment): { d: number; q: Pt } {
  const vx = s.b.x - s.a.x, vy = s.b.y - s.a.y;
  const len2 = vx * vx + vy * vy || 1;
  const u = Math.max(0, Math.min(1, ((p.x - s.a.x) * vx + (p.y - s.a.y) * vy) / len2));
  const q = { x: s.a.x + u * vx, y: s.a.y + u * vy };
  return { d: Math.hypot(p.x - q.x, p.y - q.y), q };
}

function onSegment(p: Pt, s: Segment): boolean {
  return distToSegment(p, s).d < EPS;
}

/** Proper intersection of two segments (or a shared/touching point). */
function segIntersection(s1: Segment, s2: Segment): Pt | null {
  const x1 = s1.a.x, y1 = s1.a.y, x2 = s1.b.x, y2 = s1.b.y;
  const x3 = s2.a.x, y3 = s2.a.y, x4 = s2.b.x, y4 = s2.b.y;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(den) < 1e-9) {
    // parallel: share an endpoint?
    for (const p of [s1.a, s1.b]) if (onSegment(p, s2)) return p;
    for (const p of [s2.a, s2.b]) if (onSegment(p, s1)) return p;
    return null;
  }
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
  const tol = 0.002;
  if (t < -tol || t > 1 + tol || u < -tol || u > 1 + tol) return null;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

/** Snap a point onto the nearest sidewalk. */
export function snapToSidewalk(p: Pt): Pt {
  let best = { d: Infinity, q: p };
  for (const s of SIDEWALKS) {
    const r = distToSegment(p, s);
    if (r.d < best.d) best = r;
  }
  return best.q;
}

const key = (p: Pt) => `${Math.round(p.x * 2) / 2},${Math.round(p.y * 2) / 2}`;

/**
 * Shortest walk along the sidewalks between two points. Both are snapped
 * onto the network first, so callers can be a little loose about placement.
 */
export function routeAlongSidewalks(fromRaw: Pt, toRaw: Pt): Pt[] {
  const from = snapToSidewalk(fromRaw);
  const to = snapToSidewalk(toRaw);
  const nodes = new Map<string, Pt>();
  const add = (p: Pt) => nodes.set(key(p), p);
  for (const s of SIDEWALKS) { add(s.a); add(s.b); }
  for (let i = 0; i < SIDEWALKS.length; i++)
    for (let j = i + 1; j < SIDEWALKS.length; j++) {
      const p = segIntersection(SIDEWALKS[i], SIDEWALKS[j]);
      if (p) add(p);
    }
  add(from);
  add(to);

  const adj = new Map<string, Array<{ k: string; d: number }>>();
  const link = (a: Pt, b: Pt) => {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    (adj.get(key(a)) ?? adj.set(key(a), []).get(key(a))!).push({ k: key(b), d });
    (adj.get(key(b)) ?? adj.set(key(b), []).get(key(b))!).push({ k: key(a), d });
  };
  for (const s of SIDEWALKS) {
    const on = [...nodes.values()].filter((p) => onSegment(p, s));
    on.sort((p, q) => Math.hypot(p.x - s.a.x, p.y - s.a.y) - Math.hypot(q.x - s.a.x, q.y - s.a.y));
    for (let i = 1; i < on.length; i++) link(on[i - 1], on[i]);
  }

  const start = key(from), goal = key(to);
  const dist = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, string>();
  const todo = new Set<string>([start]);
  while (todo.size) {
    let cur = '', best = Infinity;
    for (const k of todo) { const d = dist.get(k) ?? Infinity; if (d < best) { best = d; cur = k; } }
    todo.delete(cur);
    if (cur === goal) break;
    for (const e of adj.get(cur) ?? []) {
      const nd = best + e.d;
      if (nd < (dist.get(e.k) ?? Infinity)) { dist.set(e.k, nd); prev.set(e.k, cur); todo.add(e.k); }
    }
  }
  if (!prev.has(goal) && start !== goal) return [fromRaw, toRaw];
  const path: Pt[] = [];
  for (let k: string | undefined = goal; k; k = prev.get(k)) {
    path.push(nodes.get(k)!);
    if (k === start) break;
  }
  const out = path.reverse();
  // include the un-snapped endpoints so the line reaches the caller's points
  if (Math.hypot(fromRaw.x - from.x, fromRaw.y - from.y) > EPS) out.unshift(fromRaw);
  if (Math.hypot(toRaw.x - to.x, toRaw.y - to.y) > EPS) out.push(toRaw);
  return out;
}

/** Running distance to each point of a polyline. */
export function cumulative(pts: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
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

/** Bounding box of a polygon. */
export function bounds(pts: Pt[]): Rect {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
