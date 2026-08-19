import { Router } from 'express';
import { db } from '../db.js';
import { BUILDINGS, DAYS, HOME_BUILDING, HOME_ROOM, getBuilding } from '../campus.js';
import { buildingLabel, getLabels, roomLabel } from '../labels.js';

const router = Router();

/** Public: buildings, rooms, weekday schedule, and display-name overrides. */
router.get('/campus', (_req, res) => {
  res.json({
    days: DAYS,
    home: { building: HOME_BUILDING, room: HOME_ROOM },
    buildings: BUILDINGS,
    labels: getLabels(),
  });
});

/** Public: a staff member requests a bin. No login. */
router.post('/signups', (req, res) => {
  const b = req.body ?? {};
  const name = String(b.name ?? '').trim();
  const locationType = b.locationType === 'office' ? 'office' : b.locationType === 'classroom' ? 'classroom' : null;
  const buildingKey = String(b.building ?? '');
  const isCustom = !!b.isCustomLocation;
  const room = String(b.room ?? '').trim();
  const roomDetail = String(b.roomDetail ?? '').trim();

  if (!name) return void res.status(400).json({ error: 'Please enter your name.' });
  if (!locationType) return void res.status(400).json({ error: 'Choose Classroom or Office.' });
  const building = getBuilding(buildingKey);
  if (!building) return void res.status(400).json({ error: 'Choose a building.' });
  if (!room) {
    return void res.status(400).json({
      error: isCustom ? 'Describe your location.' : 'Choose your room or office.',
    });
  }
  if (!isCustom && !building.rooms.includes(room)) {
    return void res.status(400).json({ error: 'That room is not in the selected building.' });
  }
  if (!isCustom && room === 'Admin Office' && !roomDetail) {
    return void res.status(400).json({ error: 'Tell us where in the Admin Office.' });
  }
  if (name.length > 100 || room.length > 120 || roomDetail.length > 200) {
    return void res.status(400).json({ error: 'That entry is too long.' });
  }

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO signups (name, location_type, building, room, room_detail, is_custom)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(name, locationType, building.key, room, roomDetail, isCustom ? 1 : 0);

  const labels = getLabels();
  res.status(201).json({
    id: Number(lastInsertRowid),
    building: buildingLabel(building.key, labels),
    room: isCustom ? room : roomLabel(building.key, room, labels),
  });
});

export default router;
