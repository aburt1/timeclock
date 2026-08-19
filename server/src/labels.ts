import { db } from './db.js';
import { getBuilding } from './campus.js';

export const buildingKey = (b: string) => `b:${b}`;
export const roomKey = (b: string, room: string) => `r:${b}|${room}`;

export function getLabels(): Record<string, string> {
  const rows = db.prepare('SELECT key, label FROM map_labels').all() as Array<{
    key: string;
    label: string;
  }>;
  return Object.fromEntries(rows.map((r) => [r.key, r.label]));
}

export function setLabel(key: string, label: string): void {
  if (label) {
    db.prepare(
      'INSERT INTO map_labels (key, label) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET label = excluded.label'
    ).run(key, label);
  } else {
    db.prepare('DELETE FROM map_labels WHERE key = ?').run(key);
  }
}

/** Is this a key we recognise (so admins can't fill the table with junk)? */
export function isValidLabelKey(key: string): boolean {
  if (key.startsWith('b:')) return !!getBuilding(key.slice(2));
  if (key.startsWith('r:')) {
    const rest = key.slice(2);
    const i = rest.indexOf('|');
    if (i < 0) return false;
    const b = getBuilding(rest.slice(0, i));
    return !!b && b.rooms.includes(rest.slice(i + 1));
  }
  return false;
}

export function buildingLabel(bKey: string, labels = getLabels()): string {
  return labels[buildingKey(bKey)] ?? getBuilding(bKey)?.name ?? bKey;
}

export function roomLabel(bKey: string, room: string, labels = getLabels()): string {
  return labels[roomKey(bKey, room)] ?? room;
}
