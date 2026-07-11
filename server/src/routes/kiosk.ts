import { Router } from 'express';
import { db, findOpenSession, nowIso } from '../db.js';

const router = Router();

// Current roster + who's clocked in, for the student-facing screen.
router.get('/state', (_req, res) => {
  const students = db
    .prepare(
      'SELECT id, name, shape, color FROM students WHERE active = 1 ORDER BY sort_order, name'
    )
    .all() as Array<{ id: number; name: string; shape: string; color: string }>;

  res.json({
    students: students.map((s) => {
      const open = findOpenSession(s.id);
      return { ...s, clockedIn: !!open, since: open?.clock_in ?? null };
    }),
  });
});

// One tap = one punch. clientEventId makes offline retries idempotent.
router.post('/punch', (req, res) => {
  const { studentId, action, timestamp, clientEventId } = req.body ?? {};

  if (action !== 'IN' && action !== 'OUT') {
    res.status(400).json({ error: 'action must be IN or OUT' });
    return;
  }
  const student = db
    .prepare('SELECT id, name FROM students WHERE id = ? AND active = 1')
    .get(Number(studentId)) as { id: number; name: string } | undefined;
  if (!student) {
    res.status(404).json({ error: 'unknown student' });
    return;
  }

  const ts =
    typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp))
      ? new Date(timestamp).toISOString()
      : nowIso();

  if (typeof clientEventId === 'string' && clientEventId) {
    try {
      db.prepare('INSERT INTO processed_events (client_event_id) VALUES (?)').run(
        clientEventId
      );
    } catch {
      res.json({ ok: true, status: 'duplicate' });
      return;
    }
  }

  const open = findOpenSession(student.id);

  if (action === 'IN') {
    if (open) {
      res.json({ ok: true, status: 'already_in', since: open.clock_in });
      return;
    }
    db.prepare(
      "INSERT INTO sessions (student_id, clock_in, created_via) VALUES (?, ?, 'kiosk')"
    ).run(student.id, ts);
    res.json({ ok: true, status: 'in', at: ts });
    return;
  }

  if (open) {
    // Guard against a clock-out timestamped before its clock-in (clock skew,
    // stale offline queue) — clamp to the clock-in time.
    const outTs = Date.parse(ts) < Date.parse(open.clock_in) ? open.clock_in : ts;
    db.prepare(
      "UPDATE sessions SET clock_out = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?"
    ).run(outTs, open.id);
    const minutes = Math.round((Date.parse(outTs) - Date.parse(open.clock_in)) / 60000);
    res.json({ ok: true, status: 'out', at: outTs, minutes });
    return;
  }

  db.prepare(
    "INSERT INTO sessions (student_id, clock_out, note, created_via) VALUES (?, ?, 'Tapped OUT without a clock-in', 'kiosk')"
  ).run(student.id, ts);
  res.json({ ok: true, status: 'out_no_in', at: ts });
});

export default router;
