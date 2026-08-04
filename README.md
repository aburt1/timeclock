# ♻️ Recycling Time Clock

A big-button time clock built for a **high school special education classroom**
that runs a recycling work program. Students tap their name and shape on a
shared tablet or Chromebook to clock in and out of their shift — practicing the
same punch-in/punch-out routine they'll use if they ever hold a job with a real
time clock. The goal is the *habit*: walk in, find your name, clock in, do your
work, clock out. The confirmation screens celebrate it ("You worked 1h 30m! 🎉")
because this is a teaching tool first and a timesheet second.

The teacher gets a password-protected admin page to view hours, quickly fix
punches, run simple reports, manage the roster, and export everything to CSV.

## Design philosophy: deliberately lightweight

This app is intentionally small, because of who runs it: **one teacher, without
a technical background, who needs it to just work** — every school day, without
maintenance, on whatever device is handy.

That drives every technical choice:

- **One container, one process, one database file.** No external services, no
  managed database, no third-party APIs that can expire or change pricing. The
  entire state of the app is a single SQLite file you can copy to back up.
- **No accounts for students.** The kiosk is open by design — big cards,
  shapes, and colors instead of logins, built for students who may not read
  fluently. Accessibility over auth.
- **Editing is forgiving, not forensic.** This is a classroom activity, not a
  payroll or accountability system. The teacher can fix a forgotten clock-out
  in two taps ("Out now"), nudge times inline, or delete a bad punch. Nothing
  is locked, versioned, or audited.
- **Offline-tolerant.** School wifi drops; punches queue in the browser and
  sync when the connection returns, with dedupe so retries can't double-record.
- **Boring, proven pieces.** React, Express, SQLite. Nothing exotic to break
  or babysit.

If you're looking for shift-scheduling, payroll integration, or tamper-proof
audit trails, this is the wrong tool on purpose.

## How it works

- **Kiosk** (`/`) — huge student cards (shape + color + name), one tap to pick
  yourself, then giant CLOCK IN / CLOCK OUT buttons with a friendly
  confirmation. Students can have their shape and color changed (or change
  their minds) freely on the admin roster page.
- **Admin** (`/admin`) — timesheet with per-student totals, inline time
  editing, flags for anything odd ("● still in", "⚠ missing" a punch), a
  Reports tab (hours by student, hours by day, date-range presets), roster
  management, and one-click CSV export.
- **Storage** — a single SQLite file at `/data/timeclock.db`. Back it up by
  copying one file, or use **Export all** in the admin page.

A fresh install seeds nine example students (Alex, Bailey, Casey, …) so the
kiosk works immediately — rename them to your own roster on the admin page.

## Stack

| Piece    | Tech |
|----------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Backend  | Node 24, Express 5, built-in `node:sqlite` (no native deps) |
| Deploy   | Single Docker container (Dockerfile + docker-compose.yml) |

## Local development

```bash
npm install
npm run dev
```

- Web app with hot reload: http://localhost:5173 (proxies `/api` to the server)
- API server: http://localhost:3000
- Dev admin password defaults to `admin` (set `ADMIN_PASSWORD` to override).
- The database is created and seeded automatically at
  `server/data/timeclock.db` on first run.

Production-style run (server serves the built frontend):

```bash
npm run build
ADMIN_PASSWORD=yourpassword npm start
# → http://localhost:3000
```

## Deploying (Coolify or any Docker host)

1. Point your host at this repo. With Coolify: **New Resource → your Git
   source**, Docker Compose build pack — it picks up `docker-compose.yml`.
2. Set environment variables:
   - `ADMIN_PASSWORD` — the teacher login password (**required**; the app
     refuses to start without it)
   - `TZ` — your timezone, e.g. `America/Los_Angeles` (used for CSV exports)
3. Keep the `/data` volume persistent (the compose file declares
   `timeclock-data`) — that's where the SQLite database lives.
4. Put your domain in front of it; the container listens on port 3000 and the
   compose file deliberately does **not** publish a host port, since proxies
   like Traefik route to the container directly.

## API sketch

```
GET  /api/kiosk/state            roster + who's clocked in
POST /api/kiosk/punch            { studentId, action: IN|OUT, timestamp, clientEventId }

POST /api/admin/login            { password } → session cookie (30 days)
GET  /api/admin/sessions?from&to&studentId
POST/PATCH/DELETE /api/admin/sessions[/:id]
GET/POST/PATCH/DELETE /api/admin/students[/:id]
GET  /api/admin/export.csv?from&to&studentId
```

Punches are idempotent via `clientEventId`, so the kiosk's offline retry queue
can never create duplicate records.

## Later: social login

Admin auth is a single shared password (HMAC-signed cookie) — one teacher, one
password, nothing to administer. The `requireAdmin` middleware in
`server/src/auth.ts` is the single gate; swapping it for Google OAuth later
only touches that file and the login screen.
