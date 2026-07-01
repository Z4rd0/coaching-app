"use client";

import type {
  Segment,
  StrengthSegment,
  Exercise,
  SegmentPurpose,
} from "@/types";
import ExerciseForm from "./ExerciseForm";

/**
 * Segment-native authoring for "hybrid" sessions (MIGRATION_SEGMENTS.md, step
 * 3b/2). Isolated from the legacy ProgramBuilder form: it edits session.segments
 * and the parent saves with segments authoritative (serializeSessionForWrite
 * detects type "hybrid"). STEP (a): the StrengthSegment editor incl. supersets
 * A1/A2. Endurance/Conditioning editors arrive in (b)/(c).
 */

const sid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const emptyExercise = (): Exercise => ({ name: "", sets: 3, reps: "8", load: "", notes: "" });

function emptyStrengthSegment(): StrengthSegment {
  return { id: sid(), kind: "strength", purpose: "main", groups: [{ items: [emptyExercise()] }] };
}

const PURPOSES: { v: SegmentPurpose; label: string }[] = [
  { v: "warmup", label: "Riscaldamento" },
  { v: "main", label: "Principale" },
  { v: "accessory", label: "Accessori" },
  { v: "cooldown", label: "Defaticamento" },
  { v: "mobility", label: "Mobilità" },
];

const selectCls =
  "bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary";
const numCls =
  "w-16 bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-primary";

// ─── Strength segment editor ──────────────────────────────────────────────────

function StrengthEditor({
  seg,
  onChange,
}: {
  seg: StrengthSegment;
  onChange: (s: StrengthSegment) => void;
}) {
  const setGroups = (groups: StrengthSegment["groups"]) => onChange({ ...seg, groups });
  const updateGroup = (gi: number, g: StrengthSegment["groups"][number]) =>
    setGroups(seg.groups.map((x, i) => (i === gi ? g : x)));
  const addGroup = () => setGroups([...seg.groups, { items: [emptyExercise()] }]);
  const removeGroup = (gi: number) => setGroups(seg.groups.filter((_, i) => i !== gi));

  const addItem = (gi: number) => {
    const g = seg.groups[gi];
    updateGroup(gi, {
      ...g,
      items: [...g.items, emptyExercise()],
      label: g.label ?? String.fromCharCode(65 + gi), // A, B, … → superset
      rounds: g.rounds ?? 3,
    });
  };
  const removeItem = (gi: number, ii: number) => {
    const g = seg.groups[gi];
    const items = g.items.filter((_, i) => i !== ii);
    // Dropping back to a single item turns the superset back into a plain exercise.
    updateGroup(gi, items.length > 1 ? { ...g, items } : { items });
  };

  return (
    <div className="space-y-2">
      {seg.groups.map((g, gi) => {
        const isSuperset = g.items.length > 1;
        const label = g.label ?? String.fromCharCode(65 + gi);
        return (
          <div key={gi} className="rounded-lg border border-slate-700 bg-slate-900/40 p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">
                {isSuperset ? `Superset ${label}` : `Esercizio ${gi + 1}`}
              </span>
              <button
                type="button"
                onClick={() => removeGroup(gi)}
                className="text-[11px] text-red-400 hover:text-red-300"
              >
                Rimuovi
              </button>
            </div>

            {isSuperset && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <label className="flex items-center gap-1">
                  Round
                  <input
                    type="number"
                    min={1}
                    value={g.rounds ?? 3}
                    onChange={(e) => updateGroup(gi, { ...g, rounds: +e.target.value || 1 })}
                    className={numCls}
                  />
                </label>
                <label className="flex items-center gap-1">
                  Rec. dopo (s)
                  <input
                    type="number"
                    min={0}
                    value={g.restSecondsAfter ?? ""}
                    onChange={(e) =>
                      updateGroup(gi, {
                        ...g,
                        restSecondsAfter: e.target.value ? +e.target.value : undefined,
                      })
                    }
                    placeholder="90"
                    className={numCls}
                  />
                </label>
              </div>
            )}

            {g.items.map((ex, ii) => (
              <ExerciseForm
                key={ii}
                exercise={ex}
                index={ii}
                canRemove={g.items.length > 1}
                onChange={(updated) =>
                  updateGroup(gi, { ...g, items: g.items.map((x, i) => (i === ii ? updated : x)) })
                }
                onRemove={() => removeItem(gi, ii)}
              />
            ))}

            <button
              type="button"
              onClick={() => addItem(gi)}
              className="text-primary text-[11px] font-medium"
            >
              + Aggiungi al superset (A1/A2…)
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addGroup}
        className="w-full py-1.5 text-[11px] text-slate-400 border border-dashed border-slate-600 rounded-lg hover:text-slate-200"
      >
        + Esercizio / superset
      </button>
    </div>
  );
}

// ─── Segment list ─────────────────────────────────────────────────────────────

interface Props {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
}

export default function SegmentEditor({ segments, onChange }: Props) {
  const update = (i: number, seg: Segment) => onChange(segments.map((s, idx) => (idx === i ? seg : s)));
  const remove = (i: number) => onChange(segments.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= segments.length) return;
    const copy = [...segments];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };

  return (
    <div className="space-y-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
      <p className="text-[11px] text-emerald-300 uppercase tracking-wide font-semibold">
        Blocchi (in sequenza)
      </p>

      {segments.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-2">
          Nessun blocco · aggiungine uno qui sotto
        </p>
      )}

      {segments.map((seg, i) => (
        <div key={seg.id} className="rounded-xl border border-slate-700 bg-slate-800/50 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 w-5 text-center">{i + 1}</span>
            <input
              value={seg.title ?? ""}
              onChange={(e) => update(i, { ...seg, title: e.target.value || undefined })}
              placeholder="Titolo blocco (es. Forza principale)"
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={seg.purpose ?? "main"}
              onChange={(e) => update(i, { ...seg, purpose: e.target.value as SegmentPurpose })}
              className={selectCls}
            >
              {PURPOSES.map((p) => (
                <option key={p.v} value={p.v}>{p.label}</option>
              ))}
            </select>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              className="text-slate-500 hover:text-slate-200 disabled:opacity-30 px-1">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === segments.length - 1}
              className="text-slate-500 hover:text-slate-200 disabled:opacity-30 px-1">↓</button>
            <button type="button" onClick={() => remove(i)}
              className="text-slate-600 hover:text-red-400 px-1">✕</button>
          </div>

          {seg.kind === "strength" ? (
            <StrengthEditor seg={seg} onChange={(s) => update(i, s)} />
          ) : (
            <p className="text-[11px] text-slate-500 italic px-1">
              Blocco &quot;{seg.kind}&quot; — editor in arrivo
            </p>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...segments, emptyStrengthSegment()])}
        className="w-full py-2 text-xs text-emerald-400 border border-dashed border-emerald-500/30 rounded-xl hover:border-emerald-500/60 transition-colors"
      >
        + Blocco forza
      </button>
    </div>
  );
}
