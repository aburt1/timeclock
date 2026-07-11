export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function sessionMinutes(clockIn: string | null, clockOut: string | null): number | null {
  if (!clockIn || !clockOut) return null;
  return Math.round((Date.parse(clockOut) - Date.parse(clockIn)) / 60000);
}

/** ISO string → value for <input type="datetime-local"> in the viewer's timezone. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO string (null if empty). */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

/** Local YYYY-MM-DD for a date offset from today. */
export function localDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Start of a local calendar day (YYYY-MM-DD) as ISO. */
export function dayStartIso(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString();
}

/** End of a local calendar day (YYYY-MM-DD) as ISO. */
export function dayEndIso(day: string): string {
  return new Date(`${day}T23:59:59.999`).toISOString();
}
