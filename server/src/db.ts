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
`);

const SEED_STUDENTS: ReadonlyArray<readonly [string, string, string]> = [
  ['Bhupinder', 'circle', '#1976D2'],
  ['Payton', 'square', '#7B1FA2'],
  ['Asher', 'triangle', '#F57C00'],
  ['Zachary', 'star', '#FBC02D'],
  ['Isabella', 'heart', '#E91E63'],
  ['Odin', 'diamond', '#00ACC1'],
  ['Paulina', 'hexagon', '#795548'],
  ['Evelyn', 'pentagon', '#303F9F'],
  ['Yoli', 'cross', '#AD1457'],
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
