import { Router } from 'express';
import { db } from '../db.js';
import { getBuilding, isDay, isGroup, resolveSchedule } from '../campus.js';

const router = Router();

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

  return rows.map((r) => {
    const b = getBuilding(r.building);
    const { day, group } = resolveSchedule(r.building, r.overrideDay, r.overrideGroup);
    return {
      ...r,
      isCustom: !!r.isCustom,
      buildingName: b?.name ?? r.building,
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
        s.room,
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
