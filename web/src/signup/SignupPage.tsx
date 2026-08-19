import { useEffect, useMemo, useState } from 'react';
import { api, bLabel, rLabel, type Campus } from '../lib/api';

/** Shown above the form. Edit freely — plain text, one paragraph per line. */
const PROGRAM_DESCRIPTION = [
  "Recycling With The Stars is run by North High's Moderate/Severe Special Education class. " +
    'Our students collect paper and plastic recycling from classrooms and offices around campus ' +
    'during 6th period, building real job skills along the way.',
  'Want a recycling bin in your room? Fill this out (it takes under a minute) and we will add ' +
    'you to a weekly pickup day. No account needed.',
];

const OTHER = '__other__';

export default function SignupPage() {
  const [campus, setCampus] = useState<Campus | null>(null);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [locationType, setLocationType] = useState<'classroom' | 'office' | ''>('');
  const [roomChoice, setRoomChoice] = useState(''); // "buildingKey|room" or OTHER
  const [customDesc, setCustomDesc] = useState('');
  const [customBuilding, setCustomBuilding] = useState('');
  const [adminDetail, setAdminDetail] = useState('');

  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ building: string; room: string } | null>(null);

  useEffect(() => {
    api
      .campus()
      .then(setCampus)
      .catch(() => setLoadError("Couldn't load the room list. Please refresh."));
  }, []);

  const isOther = roomChoice === OTHER;
  const [chosenBuildingKey, chosenRoom] = useMemo(() => {
    if (!roomChoice || isOther) return ['', ''];
    const i = roomChoice.indexOf('|');
    return [roomChoice.slice(0, i), roomChoice.slice(i + 1)];
  }, [roomChoice, isOther]);
  const isAdminOffice = chosenRoom === 'Admin Office';

  function validate(): string[] {
    const e: string[] = [];
    if (!name.trim()) e.push('Please enter your name.');
    if (!locationType) e.push('Choose Classroom or Office.');
    if (!roomChoice) e.push('Choose your room or office.');
    if (isOther) {
      if (!customDesc.trim()) e.push('Describe your location (e.g. "Portable 3").');
      if (!customBuilding) e.push('Pick the nearest building so we can schedule you.');
    }
    if (isAdminOffice && !adminDetail.trim()) e.push('Tell us where in the Admin Office.');
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (e.length) return;
    setBusy(true);
    try {
      const result = await api.submitSignup({
        name: name.trim(),
        locationType: locationType as 'classroom' | 'office',
        building: isOther ? customBuilding : chosenBuildingKey,
        room: isOther ? customDesc.trim() : chosenRoom,
        roomDetail: isAdminOffice ? adminDetail.trim() : '',
        isCustomLocation: isOther,
      });
      setDone({ building: result.building, room: result.room });
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Something went wrong. Please try again.']);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'border-2 border-slate-300 rounded-xl px-4 py-3 font-bold text-base bg-white w-full';

  return (
    <div className="min-h-screen bg-gradient-to-b from-rtc-sky1 to-rtc-sky2">
      <div className="max-w-xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black text-rtc-green-dark">♻️ Recycling With The Stars</h1>
          <p className="text-rtc-gray font-bold mt-1">Request a recycling bin for your room</p>
        </header>

        <section className="bg-white rounded-3xl shadow-sm p-5 mb-5 space-y-3">
          {PROGRAM_DESCRIPTION.map((p, i) => (
            <p key={i} className="text-rtc-ink leading-relaxed">
              {p}
            </p>
          ))}
        </section>

        {done ? (
          <div className="bg-white rounded-3xl shadow-sm p-6 text-center">
            <div className="text-5xl mb-2">✅</div>
            <p className="text-xl font-black">
              Thanks, {name.trim()}! We've got you down for <span className="text-rtc-green-dark">{done.room}</span> in{' '}
              <span className="text-rtc-green-dark">{done.building}</span>.
            </p>
            <p className="text-rtc-gray font-bold mt-3">
              We'll drop off a bin and let you know your pickup day.
            </p>
            <button
              type="button"
              onClick={() => {
                setDone(null);
                setName('');
                setLocationType('');
                setRoomChoice('');
                setCustomDesc('');
                setCustomBuilding('');
                setAdminDetail('');
                setErrors([]);
              }}
              className="mt-6 text-sm font-bold text-rtc-gray underline"
            >
              Sign up another room
            </button>
          </div>
        ) : loadError ? (
          <p className="text-rtc-red font-bold">{loadError}</p>
        ) : !campus ? (
          <p className="text-rtc-gray font-bold">Loading…</p>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-3xl shadow-sm p-6 flex flex-col gap-5" noValidate>
            <label className="flex flex-col gap-1.5 font-bold">
              Your name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className={inputCls}
              />
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="font-bold mb-1.5">This location is a…</legend>
              <div className="grid grid-cols-2 gap-3">
                {(['classroom', 'office'] as const).map((t) => (
                  <label
                    key={t}
                    className={`flex items-center justify-center gap-2 border-2 rounded-xl px-4 py-3 font-bold cursor-pointer ${
                      locationType === t
                        ? 'border-rtc-green bg-green-50 text-rtc-green-dark'
                        : 'border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="locationType"
                      value={t}
                      checked={locationType === t}
                      onChange={() => setLocationType(t)}
                      className="w-4 h-4"
                    />
                    {t === 'classroom' ? '🏫 Classroom' : '🗂️ Office'}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex flex-col gap-1.5 font-bold">
              Room / office
              <select
                value={roomChoice}
                onChange={(e) => setRoomChoice(e.target.value)}
                className={inputCls}
              >
                <option value="">Choose your room…</option>
                {campus.buildings.map((b) => (
                  <optgroup key={b.key} label={bLabel(campus, b)}>
                    {b.rooms.map((r) => (
                      <option key={r} value={`${b.key}|${r}`}>
                        {rLabel(campus, b.key, r)}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <optgroup label="Not listed?">
                  <option value={OTHER}>Other (not listed)</option>
                </optgroup>
              </select>
            </label>

            {isOther && (
              <div className="flex flex-col gap-4 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
                <label className="flex flex-col gap-1.5 font-bold">
                  Describe your location
                  <input
                    type="text"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    placeholder={'e.g. "Portable 3" or "Nurse\'s office"'}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1.5 font-bold">
                  Nearest building
                  <select
                    value={customBuilding}
                    onChange={(e) => setCustomBuilding(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Pick the closest one…</option>
                    {campus.buildings.map((b) => (
                      <option key={b.key} value={b.key}>
                        {bLabel(campus, b)}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-rtc-gray font-bold">
                    This puts you on the right pickup day.
                  </span>
                </label>
              </div>
            )}

            {isAdminOffice && (
              <label className="flex flex-col gap-1.5 font-bold">
                Where in the Admin Office?
                <input
                  type="text"
                  value={adminDetail}
                  onChange={(e) => setAdminDetail(e.target.value)}
                  placeholder="e.g. front desk, attendance window, counseling"
                  className={inputCls}
                />
              </label>
            )}

            {errors.length > 0 && (
              <ul className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 text-rtc-red font-bold text-sm list-disc pl-8">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <button
              type="submit"
              disabled={busy}
              className="bg-rtc-green text-white text-xl font-black rounded-2xl py-4 shadow-[0_6px_0_var(--color-rtc-green-dark)] active:translate-y-1 active:shadow-[0_2px_0_var(--color-rtc-green-dark)] transition-all disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Request a bin'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-rtc-gray font-bold mt-6">
          Questions? Ask the Special Education team in DA4.
        </p>
      </div>
    </div>
  );
}
