# ♻️ Recycling Time Clock

A big-button time clock for a high school recycling work program. Students tap
their name and shape on a shared tablet/Chromebook to clock in and out; the
teacher gets a password-protected admin page to view hours, fix punches, manage
the roster, and export everything to CSV.

## How it works

- **Kiosk** (`/`) — huge student cards (shape + color + name), one tap to pick
  yourself, then giant CLOCK IN / CLOCK OUT buttons with a spoken-language
  confirmation. If wifi drops, punches are saved in the browser and synced
  automatically when it's back — with dedupe so nothing double-records.
- **Admin** (`/admin`) — timesheet with per-student totals, editable
  clock-in/out times, flags for missing punches ("still in", "needs a fix"),
  roster management (add/rename/recolor/deactivate students), and CSV export.
- **Storage** — a single SQLite file, no external services. Back it up by
  copying one file.

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
- The database is created automatically at `server/data/timeclock.db` and is
  seeded with the original 9 students on first run.

Production-style run (server serves the built frontend):

```bash
npm run build
ADMIN_PASSWORD=yourpassword npm start
# → http://localhost:3000
```

## Deploying on Coolify

1. Push this repo to Git (GitHub/GitLab or Coolify's own Git).
2. In Coolify: **New Resource → Docker Compose** (or Dockerfile) pointing at
   this repo.
3. Set environment variables:
   - `ADMIN_PASSWORD` — the teacher login password (**required**)
   - `TZ` — your timezone, e.g. `America/New_York` (used for CSV export times)
4. Make sure the `/data` volume is persistent (the compose file declares
   `timeclock-data`) — that's where the SQLite database lives.
5. Deploy, then open the app URL. `/` is the kiosk, `/admin` is the teacher
   page.

### Backups

Everything is in one file: `/data/timeclock.db` inside the volume. Copy it out
on whatever schedule you like, or just use **Export all** in the admin page to
download a full CSV.

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

Admin auth is a single shared password for now (HMAC-signed cookie). The
`requireAdmin` middleware in `server/src/auth.ts` is the single gate — swapping
it for Google OAuth later only touches that file and the login screen.
