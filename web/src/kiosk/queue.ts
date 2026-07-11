import type { PunchResult } from '../lib/api';

export type QueuedPunch = {
  clientEventId: string;
  studentId: number;
  action: 'IN' | 'OUT';
  timestamp: string;
};

const KEY = 'rtc_punch_queue';

function load(): QueuedPunch[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedPunch[]) : [];
  } catch {
    return [];
  }
}

function save(queue: QueuedPunch[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    /* storage unavailable — punches still go straight to the server */
  }
}

export function queueSize(): number {
  return load().length;
}

async function post(punch: QueuedPunch): Promise<PunchResult | null> {
  const res = await fetch('/api/kiosk/punch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(punch),
  });
  if (res.ok) return (await res.json()) as PunchResult;
  // 4xx (bad student, malformed) will never succeed on retry — drop it.
  if (res.status >= 400 && res.status < 500) return null;
  throw new Error(`server ${res.status}`);
}

/** Send a punch; on network/server failure queue it for retry. */
export async function sendPunch(
  punch: QueuedPunch
): Promise<{ offline: boolean; result: PunchResult | null }> {
  try {
    const result = await post(punch);
    return { offline: false, result };
  } catch {
    const q = load();
    q.push(punch);
    save(q);
    return { offline: true, result: null };
  }
}

/** Retry everything in the queue. Returns how many punches are still stuck. */
export async function flushQueue(): Promise<number> {
  const q = load();
  if (q.length === 0) return 0;
  const remaining: QueuedPunch[] = [];
  for (const punch of q) {
    try {
      await post(punch);
    } catch {
      remaining.push(punch);
    }
  }
  save(remaining);
  return remaining.length;
}
