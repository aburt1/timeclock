import { Router } from 'express';
import { db } from '../db.js';
import adminSignups from './adminSignups.js';
import {
  checkPassword,
  clearedCookie,
  isAuthed,
  lockSecondsRemaining,
  recordLoginAttempt,
  requireAdmin,
  sessionCookie,
} from '../auth.js';

const router = Router();

/* ---------- auth ---------- */

router.post('/login', (req, res) => {
  const ip = req.ip ?? 'unknown';
  const wait = lockSecondsRemaining(ip);
  if (wait > 0) {
    res.status(429).json({ error: `Too many attempts. Try again in ${wait}s.` });
    return;
  }
  const ok = checkPassword(String(req.body?.password ?? ''));
  recordLoginAttempt(ip, ok);
  if (!ok) {
    res.status(401).json({ error: 'Wrong password' });
    return;
  }
  res.setHeader('Set-Cookie', sessionCookie());
  res.json({ ok: true });
});

router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearedCookie());
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ authed: isAuthed(req) });
});

router.use(requireAdmin);

router.use('/signups', adminSignups);

/* ---------- students ---------- */

router.get('/students', (_req, res) => {
  res.json({
    students: db
      .prepare(
        'SELECT id, name, shape, color, active, sort_order AS sortOrder FROM students ORDER BY sort_order, name'
      )
      .all(),
  });
});

router.post('/students', (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const shape = String(req.body?.shape ?? 'circle');
  const color = String(req.body?.color ?? '#1976D2');
  const { maxSort } = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM students')
    .get() as { maxSort: number };
  const { lastInsertRowid } = db
    .prepare('INSERT INTO students (name, shape, color, sort_order) VALUES (?, ?, ?, ?)')
    .run(name, shape, color, maxSort + 1);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

router.patch('/students/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const b = req.body ?? {};
  if ('name' in b) {
    const name = String(b.name).trim();
    if (!name) {
      res.status(400).json({ error: 'name cannot be empty' });
      return;
    }
    db.prepare('UPDATE students SET name = ? WHERE id = ?').run(name, id);
  }
  if ('shape' in b) db.prepare('UPDATE students SET shape = ? WHERE id = ?').run(String(b.shape), id);
  if ('color' in b) db.prepare('UPDATE students SET color = ? WHERE id = ?').run(String(b.color), id);
  if ('active' in b) db.prepare('UPDATE students SET active = ? WHERE id = ?').run(b.active ? 1 : 0, id);
  res.json({ ok: true });
});

router.delete('/students/:id', (req, res) => {
  const id = Number(req.params.id);
  const { n } = db
    .prepare('SELECT COUNT(*) AS n FROM sessions WHERE student_id = ?')
    .get(id) as { n: number };
  if (n > 0) {
    res.status(409).json({
      error: `This student has ${n} recorded session(s). Deactivate them instead to keep the history.`,
    });
    return;
  }
  db.prepare('DELETE FROM students WHERE id = ?').run(id);
  res.json({ ok: true });
});

/* ---------- sessions ---------- */

function sessionQuery(params: { from?: string; to?: string; studentId?: string }) {
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (params.from) {
    where.push('COALESCE(s.clock_in, s.clock_out) >= ?');
    args.push(params.from);
  }
  if (params.to) {
    where.push('COALESCE(s.clock_in, s.clock_out) <= ?');
    args.push(params.to);
  }
  if (params.studentId) {
    where.push('s.student_id = ?');
    args.push(Number(params.studentId));
  }
  const sql = `
    SELECT s.id, s.student_id AS studentId, st.name AS studentName,
           st.shape, st.color,
           s.clock_in AS clockIn, s.clock_out AS clockOut,
           s.note, s.created_via AS createdVia
    FROM sessions s JOIN students st ON st.id = s.student_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY COALESCE(s.clock_in, s.clock_out) DESC`;
  return { sql, args };
}

router.get('/sessions', (req, res) => {
  const { sql, args } = sessionQuery(req.query as Record<string, string>);
  res.json({ sessions: db.prepare(sql).all(...args) });
});

function parseIsoOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined; // not provided → leave unchanged
  if (v === null || v === '') return null;
  const t = Date.parse(String(v));
  if (Number.isNaN(t)) throw new Error('invalid timestamp');
  return new Date(t).toISOString();
}

router.post('/sessions', (req, res) => {
  const b = req.body ?? {};
  const student = db.prepare('SELECT id FROM students WHERE id = ?').get(Number(b.studentId));
  if (!student) {
    res.status(400).json({ error: 'unknown student' });
    return;
  }
  let clockIn: string | null | undefined;
  let clockOut: string | null | undefined;
  try {
    clockIn = parseIsoOrNull(b.clockIn) ?? null;
    clockOut = parseIsoOrNull(b.clockOut) ?? null;
  } catch {
    res.status(400).json({ error: 'invalid timestamp' });
    return;
  }
  if (!clockIn && !clockOut) {
    res.status(400).json({ error: 'need at least a clock-in or clock-out time' });
    return;
  }
  if (clockIn && clockOut && Date.parse(clockOut) < Date.parse(clockIn)) {
    res.status(400).json({ error: 'clock-out is before clock-in' });
    return;
  }
  const { lastInsertRowid } = db
    .prepare(
      "INSERT INTO sessions (student_id, clock_in, clock_out, note, created_via) VALUES (?, ?, ?, ?, 'admin')"
    )
    .run(Number(b.studentId), clockIn, clockOut, String(b.note ?? ''));
  res.status(201).json({ id: Number(lastInsertRowid) });
});

router.patch('/sessions/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare('SELECT clock_in AS clockIn, clock_out AS clockOut FROM sessions WHERE id = ?')
    .get(id) as { clockIn: string | null; clockOut: string | null } | undefined;
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const b = req.body ?? {};
  let clockIn: string | null | undefined;
  let clockOut: string | null | undefined;
  try {
    clockIn = parseIsoOrNull(b.clockIn);
    clockOut = parseIsoOrNull(b.clockOut);
  } catch {
    res.status(400).json({ error: 'invalid timestamp' });
    return;
  }
  const nextIn = clockIn === undefined ? row.clockIn : clockIn;
  const nextOut = clockOut === undefined ? row.clockOut : clockOut;
  if (!nextIn && !nextOut) {
    res.status(400).json({ error: 'session needs at least one time' });
    return;
  }
  if (nextIn && nextOut && Date.parse(nextOut) < Date.parse(nextIn)) {
    res.status(400).json({ error: 'clock-out is before clock-in' });
    return;
  }
  const note = 'note' in b ? String(b.note ?? '') : undefined;
  db.prepare(
    `UPDATE sessions SET
       clock_in = ?,
       clock_out = ?,
       note = COALESCE(?, note),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = ?`
  ).run(nextIn, nextOut, note ?? null, id);
  res.json({ ok: true });
});

router.delete('/sessions/:id', (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

/* ---------- CSV export ---------- */

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

router.get('/export.csv', (req, res) => {
  const { sql, args } = sessionQuery(req.query as Record<string, string>);
  const rows = db.prepare(sql).all(...args) as Array<{
    studentName: string;
    clockIn: string | null;
    clockOut: string | null;
    note: string;
    createdVia: string;
  }>;

  const dateFmt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const lines = [
    'Student,Date,Clock In,Clock Out,Minutes,Note,Source,Clock In ISO,Clock Out ISO',
  ];
  for (const r of rows) {
    const anchor = r.clockIn ?? r.clockOut;
    const minutes =
      r.clockIn && r.clockOut
        ? Math.round((Date.parse(r.clockOut) - Date.parse(r.clockIn)) / 60000)
        : '';
    lines.push(
      [
        r.studentName,
        anchor ? dateFmt.format(new Date(anchor)) : '',
        r.clockIn ? timeFmt.format(new Date(r.clockIn)) : '',
        r.clockOut ? timeFmt.format(new Date(r.clockOut)) : '',
        minutes,
        r.note,
        r.createdVia,
        r.clockIn ?? '',
        r.clockOut ?? '',
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="recycling-time-clock-${today}.csv"`
  );
  res.send(lines.join('\n') + '\n');
});

export default router;
