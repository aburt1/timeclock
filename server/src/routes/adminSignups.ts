import { Router } from 'express';
import { db } from '../db.js';
import { getBuilding, isDay, isGroup, resolveSchedule } from '../campus.js';
import { buildingLabel, getLabels, isValidLabelKey, roomLabel, setLabel } from '../labels.js';

const router = Router();

/* ---------- map label overrides (double-click-to-rename) ---------- */

router.put('/labels', (req, res) => {
  const key = String(req.body?.key ?? '');
  const label = String(req.body?.label ?? '').trim().slice(0, 60);
  if (!isValidLabelKey(key)) return void res.status(400).json({ error: 'unknown map spot' });
  setLabel(key, label);
  res.json({ ok: true, labels: getLabels() });
});

type Row = {
  id: number;
  name: string;
  locationType: 'classroom' | 'office';
  building: string;
  room: string;
  roomDetail: string;
  isCustom: number;
  overrideGroup: string | null;
  overrideDay: string | null;
  submittedAt: string;
};

function allSignups() {
  const rows = db
    .prepare(
      `SELECT id, name, location_type AS locationType, building, room,
              room_detail AS roomDetail, is_custom AS isCustom,
              override_group AS overrideGroup, override_day AS overrideDay,
              submitted_at AS submittedAt
       FROM signups ORDER BY submitted_at DESC`
    )
    .all() as Row[];

  const labels = getLabels();
  return rows.map((r) => {
    const b = getBuilding(r.building);
    const { day, group } = resolveSchedule(r.building, r.overrideDay, r.overrideGroup);
    return {
      ...r,
      isCustom: !!r.isCustom,
      buildingName: b ? buildingLabel(b.key, labels) : r.building,
      roomLabel: r.isCustom ? r.room : roomLabel(r.building, r.room, labels),
      day,
      group,
    };
  });
}

router.get('/', (_req, res) => {
  res.json({ signups: allSignups() });
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM signups WHERE id = ?').get(id);
  if (!exists) return void res.status(404).json({ error: 'not found' });

  const b = req.body ?? {};
  if ('overrideDay' in b) {
    const v = b.overrideDay;
    if (v !== null && v !== '' && !isDay(v)) return void res.status(400).json({ error: 'bad day' });
    db.prepare('UPDATE signups SET override_day = ? WHERE id = ?').run(v || null, id);
  }
  if ('overrideGroup' in b) {
    const v = b.overrideGroup;
    if (v !== null && v !== '' && !isGroup(v)) return void res.status(400).json({ error: 'bad group' });
    db.prepare('UPDATE signups SET override_group = ? WHERE id = ?').run(v || null, id);
  }
  if ('building' in b) {
    if (!getBuilding(String(b.building))) return void res.status(400).json({ error: 'bad building' });
    db.prepare('UPDATE signups SET building = ? WHERE id = ?').run(String(b.building), id);
  }
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM signups WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

router.get('/export.csv', (_req, res) => {
  const lines = ['Name,Type,Building,Room,Detail,Day,Group,Custom Location,Submitted'];
  for (const s of allSignups()) {
    lines.push(
      [
        s.name,
        s.locationType,
        s.buildingName,
        s.roomLabel,
        s.roomDetail,
        s.day ?? '',
        s.group ?? '',
        s.isCustom ? 'yes' : '',
        s.submittedAt,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="recycling-signups.csv"');
  res.send(lines.join('\n') + '\n');
});

export default router;
