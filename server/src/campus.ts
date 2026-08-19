/**
 * Campus layout for the recycling pickup program.
 *
 * Buildings ("zones") are the unit of scheduling: each belongs to Group A
 * (slow walkers, close to home classroom DA4) or Group B (standard route),
 * and is collected on exactly one weekday. Room labels are room codes or
 * plain descriptions only — never staff names (they go stale).
 *
 * Built from the North High 2026/27 room map. Day/group assignments are
 * estimates from the map, not measured distances — the admin can override
 * any individual sign-up.
 */

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
export type Day = (typeof DAYS)[number];
export type Group = 'A' | 'B';

export const HOME_ROOM = 'DA4';
export const HOME_BUILDING = 'd-annex';

export type Building = {
  key: string;
  name: string;
  group: Group;
  day: Day;
  rooms: string[];
};

export const BUILDINGS: Building[] = [
  /* ---------- Group A — slow walkers, closest to DA4 ---------- */
  {
    key: 'd-annex',
    name: 'D Annex',
    group: 'A',
    day: 'Monday',
    rooms: ['DA1', 'DA2', 'DA3', 'DA4', 'DA5', 'DA6', 'DA8', 'DA10', 'History Work Room'],
  },
  {
    key: 'c-annex',
    name: 'C Annex',
    group: 'A',
    day: 'Tuesday',
    rooms: [
      'CA1', 'CA2', 'CA3', 'CA4', 'CA5', 'CA6', 'CA7', 'CA8',
      'SPED Conference Room', 'English Work Room',
    ],
  },
  {
    key: 'd-hall',
    name: 'D Hall',
    group: 'A',
    day: 'Wednesday',
    rooms: [
      'D26', 'D27', 'D28', 'D29', 'D30', 'D31', 'D32', 'D33', 'D34', 'D35', 'D36', 'D37',
      'Math Work Room',
    ],
  },
  {
    key: 'c-hall',
    name: 'C Hall',
    group: 'A',
    day: 'Thursday',
    rooms: ['C7', 'C9', 'C11', 'C13', 'C15', 'C17'],
  },
  {
    key: 'e-hall',
    name: 'E Hall',
    group: 'A',
    day: 'Friday',
    rooms: [
      'E46', 'E47', 'E48', 'E49', 'E50', 'E51', 'E52', 'E53', 'E55', 'E56', 'E57', 'E58',
    ],
  },

  /* ---------- Group B — standard route, rest of campus ---------- */
  {
    key: 'learning-center',
    name: 'Learning Center / College & Career Center',
    group: 'B',
    day: 'Monday',
    rooms: ['Learning Center', 'College & Career Center'],
  },
  {
    key: 'admin',
    name: 'Admin',
    group: 'B',
    day: 'Monday',
    rooms: [
      'Admin Office',
      'Room 2', 'Room 3', 'Room 4', 'Room 5 (ASB)', 'Room 6 (ASB)',
      'Title I / EL Office',
    ],
  },
  {
    key: 'a-loft',
    name: 'A Loft',
    group: 'B',
    day: 'Tuesday',
    rooms: ['A Loft'],
  },
  {
    key: 'library',
    name: 'Library / Textbook',
    group: 'B',
    day: 'Tuesday',
    rooms: ['Library', 'Textbooks & Duplicating'],
  },
  {
    key: 'gym',
    name: 'Gym',
    group: 'B',
    day: 'Wednesday',
    rooms: ['Gym', 'PE Office', 'J1'],
  },
  {
    key: 'trailers',
    name: 'T-Building (Trailers)',
    group: 'B',
    day: 'Wednesday',
    rooms: [
      'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7',
      'T8 (SPED Offices)', 'T9 (SPED Offices)',
      'T10', 'T11', 'T12', 'T13', 'T14',
    ],
  },
  {
    key: 'ia-quad',
    name: 'IA Quad',
    group: 'B',
    day: 'Thursday',
    rooms: ['IA1', 'IA2', 'IA3', 'IA4 (ROC)', 'IA5', 'IA6', 'IA7'],
  },
  {
    key: 'cafeteria',
    name: 'Cafeteria / SLP / Migrant Office',
    group: 'B',
    day: 'Thursday',
    rooms: ['Cafeteria', 'Speech-Language Pathology', 'Migrant / Y2L Office'],
  },
  {
    key: 'oneill',
    name: "O'Neill Hall",
    group: 'B',
    day: 'Friday',
    rooms: ['OH2 (Storage)', 'OH3 (Office)', 'OH4', 'Band Room', 'Choir Room'],
  },
  {
    key: 'b-hall',
    name: 'B Hall Offices',
    group: 'B',
    day: 'Friday',
    rooms: [
      'B68 (ISP)', 'B69', 'B70', 'B71', 'B72', 'B73 (OCI)', 'B74', 'B75 (PAC/PLUS)',
      "Dean's Office", 'SAS Office',
    ],
  },
];

const byKey = new Map(BUILDINGS.map((b) => [b.key, b]));

export function getBuilding(key: string): Building | undefined {
  return byKey.get(key);
}

export function isDay(v: unknown): v is Day {
  return typeof v === 'string' && (DAYS as readonly string[]).includes(v);
}

export function isGroup(v: unknown): v is Group {
  return v === 'A' || v === 'B';
}

/** Resolve the effective day/group for a sign-up (override wins). */
export function resolveSchedule(
  buildingKey: string,
  overrideDay: string | null,
  overrideGroup: string | null
): { day: Day | null; group: Group | null } {
  const b = byKey.get(buildingKey);
  return {
    day: isDay(overrideDay) ? overrideDay : (b?.day ?? null),
    group: isGroup(overrideGroup) ? overrideGroup : (b?.group ?? null),
  };
}
