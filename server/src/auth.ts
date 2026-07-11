import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ??
  (process.env.NODE_ENV !== 'production' ? 'admin' : '');

if (!process.env.ADMIN_PASSWORD) {
  if (ADMIN_PASSWORD) {
    console.warn("⚠️  ADMIN_PASSWORD not set — using dev default 'admin'.");
  } else {
    console.warn('⚠️  ADMIN_PASSWORD not set — admin login is disabled.');
  }
}

// Deriving the session secret from the password means changing the password
// invalidates existing sessions, and restarts don't log the teacher out.
const SECRET = createHmac('sha256', 'rtc-session-v1')
  .update(ADMIN_PASSWORD || 'disabled')
  .digest();

const COOKIE = 'rtc_admin';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function sign(exp: number): string {
  return createHmac('sha256', SECRET).update(String(exp)).digest('base64url');
}

export function sessionCookie(): string {
  const exp = Date.now() + SESSION_MS;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MS / 1000}`;
}

export function clearedCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function isAuthed(req: Request): boolean {
  const raw = req.headers.cookie ?? '';
  let token: string | null = null;
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === COOKIE) token = rest.join('=');
  }
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now()) return false;
  const expected = sign(exp);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthed(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

export function checkPassword(candidate: string): boolean {
  if (!ADMIN_PASSWORD) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Naive in-memory login throttle: 10 failures per IP → locked 5 minutes.
const failures = new Map<string, { count: number; lockedUntil: number }>();

export function lockSecondsRemaining(ip: string): number {
  const f = failures.get(ip);
  if (!f) return 0;
  return Math.max(0, Math.ceil((f.lockedUntil - Date.now()) / 1000));
}

export function recordLoginAttempt(ip: string, success: boolean): void {
  if (success) {
    failures.delete(ip);
    return;
  }
  const f = failures.get(ip) ?? { count: 0, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= 10) {
    f.lockedUntil = Date.now() + 5 * 60 * 1000;
    f.count = 0;
  }
  failures.set(ip, f);
}
