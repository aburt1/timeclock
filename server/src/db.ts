import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'timeclock.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    shape TEXT NOT NULL DEFAULT 'circle',
    color TEXT NOT NULL DEFAULT '#1976D2',
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    clock_in TEXT,
    clock_out TEXT,
    note TEXT NOT NULL DEFAULT '',
    created_via TEXT NOT NULL DEFAULT 'kiosk',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_in ON sessions(clock_in);

  -- Dedupe table so the kiosk's offline retry queue can never double-record
  CREATE TABLE IF NOT EXISTS processed_events (
    client_event_id TEXT PRIMARY KEY,
    processed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  -- Staff recycling-bin sign-ups (see server/src/campus.ts for buildings)
  CREATE TABLE IF NOT EXISTS signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location_type TEXT NOT NULL CHECK (location_type IN ('classroom','office')),
    building TEXT NOT NULL,
    room TEXT NOT NULL,
    room_detail TEXT NOT NULL DEFAULT '',
    is_custom INTEGER NOT NULL DEFAULT 0,
    override_group TEXT,
    override_day TEXT,
    submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
`);

// Example roster for a fresh install — replace with your own students on the
// admin page. Seeding only happens when the database is empty.
const SEED_STUDENTS: ReadonlyArray<readonly [string, string, string]> = [
  ['Alex', 'circle', '#1976D2'],
  ['Bailey', 'square', '#7B1FA2'],
  ['Casey', 'triangle', '#F57C00'],
  ['Devon', 'star', '#FBC02D'],
  ['Emery', 'heart', '#E91E63'],
  ['Frankie', 'diamond', '#00ACC1'],
  ['Harper', 'hexagon', '#795548'],
  ['Jordan', 'pentagon', '#303F9F'],
  ['Riley', 'cross', '#AD1457'],
];

const { n } = db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number };
if (n === 0) {
  const insert = db.prepare(
    'INSERT INTO students (name, shape, color, sort_order) VALUES (?, ?, ?, ?)'
  );
  SEED_STUDENTS.forEach(([name, shape, color], i) => insert.run(name, shape, color, i));
  console.log(`Seeded ${SEED_STUDENTS.length} students.`);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function findOpenSession(studentId: number) {
  return db
    .prepare(
      `SELECT id, clock_in FROM sessions
       WHERE student_id = ? AND clock_in IS NOT NULL AND clock_out IS NULL
       ORDER BY clock_in DESC LIMIT 1`
    )
    .get(studentId) as { id: number; clock_in: string } | undefined;
}
