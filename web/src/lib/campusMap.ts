/**
 * Where each building sits on /campus-map.png (1600 × 1236 px).
 * Coordinates are image pixels; a building can span several rectangles.
 * Buildings with no entry (e.g. A Loft) aren't drawn on the map.
 */

export const MAP_W = 1600;
export const MAP_H = 1236;

export type Rect = { x: number; y: number; w: number; h: number };

export const BUILDING_RECTS: Record<string, Rect[]> = {
  // Group A
  'd-annex': [
    { x: 136, y: 710, w: 80, h: 84 }, // DA10
    { x: 136, y: 794, w: 334, h: 166 }, // DA8…DA1, D Annex band, DA6/DA4/DA2
  ],
  'c-annex': [{ x: 136, y: 1010, w: 334, h: 150 }],
  'd-hall': [{ x: 570, y: 794, w: 440, h: 166 }],
  'c-hall': [{ x: 530, y: 1088, w: 450, h: 74 }],
  'e-hall': [
    { x: 570, y: 524, w: 440, h: 190 },
    { x: 356, y: 524, w: 70, h: 166 }, // E56–E58 column
  ],
  // Group B
  'learning-center': [{ x: 530, y: 1010, w: 214, h: 78 }],
  library: [{ x: 744, y: 1010, w: 236, h: 78 }],
  admin: [{ x: 1024, y: 1010, w: 380, h: 130 }],
  gym: [
    { x: 410, y: 110, w: 226, h: 90 },
    { x: 706, y: 184, w: 78, h: 92 }, // J1
  ],
  trailers: [{ x: 136, y: 344, w: 580, h: 146 }],
  'ia-quad': [{ x: 890, y: 80, w: 310, h: 230 }],
  cafeteria: [{ x: 980, y: 336, w: 220, h: 134 }],
  oneill: [
    { x: 1280, y: 136, w: 204, h: 174 },
    { x: 1280, y: 360, w: 64, h: 120 }, // Band
    { x: 1400, y: 400, w: 84, h: 90 }, // Choir
  ],
  'b-hall': [{ x: 1280, y: 550, w: 204, h: 410 }],
};

/** Home classroom (DA4) — where every route starts and ends. */
export const HOME_POINT = { x: 262, y: 922 };

export function buildingCenter(key: string): { x: number; y: number } | null {
  const rects = BUILDING_RECTS[key];
  if (!rects?.length) return null;
  // Use the largest rect's center so multi-part buildings anchor sensibly.
  const main = rects.reduce((a, b) => (a.w * a.h >= b.w * b.h ? a : b));
  return { x: main.x + main.w / 2, y: main.y + main.h / 2 };
}
