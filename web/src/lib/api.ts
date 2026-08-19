export type KioskStudent = {
  id: number;
  name: string;
  shape: string;
  color: string;
  clockedIn: boolean;
  since: string | null;
};

export type AdminStudent = {
  id: number;
  name: string;
  shape: string;
  color: string;
  active: number;
  sortOrder: number;
};

export type Session = {
  id: number;
  studentId: number;
  studentName: string;
  shape: string;
  color: string;
  clockIn: string | null;
  clockOut: string | null;
  note: string;
  createdVia: string;
};

export type PunchResult = {
  ok: boolean;
  status: 'in' | 'out' | 'already_in' | 'out_no_in' | 'duplicate';
  at?: string;
  since?: string;
  minutes?: number;
};

export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
export type Group = 'A' | 'B';

export type Building = {
  key: string;
  name: string;
  group: Group;
  day: Day;
  rooms: string[];
};

export type Campus = {
  days: Day[];
  home: { building: string; room: string };
  buildings: Building[];
};

export type Signup = {
  id: number;
  name: string;
  locationType: 'classroom' | 'office';
  building: string;
  buildingName: string;
  room: string;
  roomDetail: string;
  isCustom: boolean;
  overrideGroup: Group | null;
  overrideDay: Day | null;
  submittedAt: string;
  day: Day | null;
  group: Group | null;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'same-origin',
    ...init,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  kioskState: () => request<{ students: KioskStudent[] }>('/api/kiosk/state'),

  login: (password: string) =>
    request<{ ok: boolean }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/admin/logout', { method: 'POST' }),
  me: () => request<{ authed: boolean }>('/api/admin/me'),

  students: () => request<{ students: AdminStudent[] }>('/api/admin/students'),
  createStudent: (body: { name: string; shape: string; color: string }) =>
    request<{ id: number }>('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateStudent: (id: number, body: Partial<Omit<AdminStudent, 'id'>>) =>
    request<{ ok: boolean }>(`/api/admin/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteStudent: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/students/${id}`, { method: 'DELETE' }),

  sessions: (params: { from?: string; to?: string; studentId?: string }) =>
    request<{ sessions: Session[] }>(`/api/admin/sessions${qs(params)}`),
  createSession: (body: {
    studentId: number;
    clockIn: string | null;
    clockOut: string | null;
    note: string;
  }) =>
    request<{ id: number }>('/api/admin/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSession: (
    id: number,
    body: { clockIn?: string | null; clockOut?: string | null; note?: string }
  ) =>
    request<{ ok: boolean }>(`/api/admin/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteSession: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/sessions/${id}`, { method: 'DELETE' }),

  exportCsvUrl: (params: { from?: string; to?: string; studentId?: string }) =>
    `/api/admin/export.csv${qs(params)}`,

  /* ---- recycling sign-ups ---- */
  campus: () => request<Campus>('/api/campus'),
  submitSignup: (body: {
    name: string;
    locationType: 'classroom' | 'office';
    building: string;
    room: string;
    roomDetail: string;
    isCustomLocation: boolean;
  }) =>
    request<{ id: number; building: string; room: string }>('/api/signups', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  signups: () => request<{ signups: Signup[] }>('/api/admin/signups'),
  updateSignup: (
    id: number,
    body: { overrideDay?: Day | null; overrideGroup?: Group | null; building?: string }
  ) =>
    request<{ ok: boolean }>(`/api/admin/signups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteSignup: (id: number) =>
    request<{ ok: boolean }>(`/api/admin/signups/${id}`, { method: 'DELETE' }),
  signupsCsvUrl: '/api/admin/signups/export.csv',
};
