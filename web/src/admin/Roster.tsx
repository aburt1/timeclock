import { useCallback, useEffect, useState } from 'react';
import { api, type AdminStudent } from '../lib/api';
import { COLOR_CHOICES, SHAPES, ShapeIcon } from '../lib/shapes';

export default function Roster() {
  const [students, setStudents] = useState<AdminStudent[] | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { students } = await api.students();
      setStudents(students);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setError('');
    try {
      const used = new Set(students?.map((s) => s.shape));
      const shape = SHAPES.find((s) => !used.has(s)) ?? 'circle';
      const color = COLOR_CHOICES[(students?.length ?? 0) % COLOR_CHOICES.length];
      await api.createStudent({ name, shape, color });
      setNewName('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add student');
    }
  }

  async function update(id: number, patch: Partial<Omit<AdminStudent, 'id'>>) {
    setError('');
    try {
      await api.updateStudent(id, patch);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function remove(student: AdminStudent) {
    if (!window.confirm(`Delete ${student.name} from the roster?`)) return;
    setError('');
    try {
      await api.deleteStudent(student.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={addStudent} className="bg-white rounded-2xl shadow-sm p-4 flex gap-3 items-center">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New student's name"
          className="border-2 border-slate-300 rounded-xl px-4 py-2 font-bold flex-1"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="bg-rtc-green text-white font-bold rounded-xl px-5 py-2 disabled:opacity-50"
        >
          + Add student
        </button>
      </form>

      {error && <p className="text-rtc-red font-bold">{error}</p>}

      {students === null ? (
        <p className="font-bold text-rtc-gray">Loading…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {students.map((s) => (
            <StudentCard key={s.id} student={s} onUpdate={update} onDelete={remove} />
          ))}
        </div>
      )}

      <p className="text-sm text-rtc-gray font-bold">
        Tip: deactivating a student hides them from the kiosk but keeps all their hours.
      </p>
    </div>
  );
}

function StudentCard({
  student,
  onUpdate,
  onDelete,
}: {
  student: AdminStudent;
  onUpdate: (id: number, patch: Partial<Omit<AdminStudent, 'id'>>) => void;
  onDelete: (student: AdminStudent) => void;
}) {
  const [name, setName] = useState(student.name);

  useEffect(() => setName(student.name), [student.name]);

  function commitName() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== student.name) onUpdate(student.id, { name: trimmed });
    else setName(student.name);
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3 ${
        student.active ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        <ShapeIcon shape={student.shape} color={student.color} className="w-14 h-14 shrink-0" />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="border-2 border-transparent hover:border-slate-200 focus:border-slate-300 rounded-lg px-2 py-1 font-black text-lg flex-1 min-w-0"
        />
        <label className="text-xs font-bold text-rtc-gray flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={!!student.active}
            onChange={(e) => onUpdate(student.id, { active: e.target.checked ? 1 : 0 })}
            className="w-4 h-4"
          />
          Active
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SHAPES.map((shape) => (
          <button
            key={shape}
            type="button"
            title={shape}
            onClick={() => onUpdate(student.id, { shape })}
            className={`p-1 rounded-lg border-2 ${
              student.shape === shape ? 'border-blue-600 bg-blue-50' : 'border-transparent'
            }`}
          >
            <ShapeIcon shape={shape} color={student.color} className="w-7 h-7" />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {COLOR_CHOICES.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            onClick={() => onUpdate(student.id, { color })}
            style={{ backgroundColor: color }}
            className={`w-7 h-7 rounded-full border-2 ${
              student.color === color ? 'border-rtc-ink scale-110' : 'border-white'
            }`}
          />
        ))}
        <button
          type="button"
          onClick={() => onDelete(student)}
          className="ml-auto text-xs font-bold text-rtc-red"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
