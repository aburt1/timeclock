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
- **Staff sign-up** (`/signup`) — the "Recycling With The Stars" request form
  for teachers and staff who want a recycling bin: name, classroom/office,
  room picked from a dropdown grouped by building (with an "Other" escape
  hatch and a "where in the Admin Office?" follow-up). No login. Sign-ups
  are automatically placed on a two-group weekly pickup schedule.
- **Admin** (`/admin`) — timesheet with per-student totals, inline time
  editing, flags for anything odd ("● still in", "⚠ missing" a punch), a
  Reports tab (hours by student, hours by day, date-range presets), roster
  management, and a **Pickup Routes** tab — both a teacher dashboard and a
  teaching aid for the classroom board:
  - A campus map drawn **on top of an aerial photo of the school**, with
    every building placed at its real footprint and its rooms laid out inside,
    so students recognise where they are. (Imagery © Esri, Maxar, Earthstar
    Geographics — a single static image shipped with the app; no live tiles,
    no API keys.)
  - Pick a day and a group, and the map draws that walk **door to door** —
    out of DA4, along the sidewalks, down each hallway, and into every
    classroom with a bin, with the stops numbered in walking order.
  - A **slider** walks the route step by step (with a Play button) so the
    class can follow where they go and who they'll see. Nothing animates on
    its own — the teacher drives it.
  - Everything not on today's walk is dimmed, so the board stays readable
    from the back of the room.
  - The Monday–Friday schedule and a table where any sign-up's day or group
    can be overridden or removed. Double-click any building or room on the
    map to rename it — the new name shows up everywhere. CSV export too.
- **Storage** — a single SQLite file at `/data/timeclock.db`. Back it up by
  copying one file, or use **Export all** in the admin page.

### Pickup schedule rules

Every building on campus is assigned to **Group A** (the five buildings
closest to the home classroom, DA4) or **Group B** (the rest of campus), and
to exactly one weekday, matching the 6th-period collection routine:

| Day | Group A — near DA4 | Group B — around campus |
|---|---|---|
| Monday | D Annex | Learning Center / College & Career Center, Admin Office |
| Tuesday | C Annex | A Loft (Admin upstairs), Library / Textbook |
| Wednesday | D Hall | Gym / T-Building (Trailers) |
| Thursday | C Hall | IA Quad, Cafeteria / SLP / Migrant Office |
| Friday | E Hall | O'Neill Hall & B Hall Offices |

Assignments are estimates from the campus map, not measured distances — the
admin can override any individual sign-up's day or group, and that override
always wins. Buildings, rooms, and this table live in one file,
`server/src/campus.ts`; the map's building footprints, room tiles, hallway
spines, and sidewalk network are in `web/src/lib/campusLayout.ts`, in the
pixel space of `web/public/campus-aerial.jpg`. Room labels are codes
only, never staff names, so nothing goes stale when people move.

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

GET  /api/campus                 buildings, rooms, weekday schedule (public)
POST /api/signups                { name, locationType, building, room, roomDetail, isCustomLocation }
GET/PATCH/DELETE /api/admin/signups[/:id]   PATCH { overrideDay, overrideGroup, building }
GET  /api/admin/signups/export.csv
PUT  /api/admin/signups/labels   { key: "b:<building>" | "r:<building>|<room>", label }
```

Punches are idempotent via `clientEventId`, so the kiosk's offline retry queue
can never create duplicate records.

## Later: social login

Admin auth is a single shared password (HMAC-signed cookie) — one teacher, one
password, nothing to administer. The `requireAdmin` middleware in
`server/src/auth.ts` is the single gate; swapping it for Google OAuth later
only touches that file and the login screen.
