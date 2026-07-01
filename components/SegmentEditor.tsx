"use client";

import type {
  Segment,
  StrengthSegment,
  EnduranceSegment,
  ConditioningSegment,
  Exercise,
  SegmentPurpose,
  CardioFormat,
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

function emptyEnduranceSegment(): EnduranceSegment {
  return { id: sid(), kind: "endurance", purpose: "main", format: "intervals", steps: [{ reps: 1, work: { distanceM: 1000 } }] };
}

function emptyConditioningSegment(): ConditioningSegment {
  return { id: sid(), kind: "conditioning", purpose: "main", structure: "amrap", movements: [{ name: "" }] };
}

function emptyRestSegment(): Segment {
  return { id: sid(), kind: "rest" };
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
const textCls =
  "bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";
const fieldCls =
  "w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";

const CARDIO_FORMATS: { v: CardioFormat; label: string }[] = [
  { v: "continuous", label: "Continuo" },
  { v: "intervals", label: "Intervalli" },
  { v: "fartlek", label: "Fartlek" },
  { v: "tempo", label: "Tempo" },
  { v: "progression", label: "Progressivo" },
];

const STRUCTURES: { v: ConditioningSegment["structure"]; label: string }[] = [
  { v: "amrap", label: "AMRAP" },
  { v: "emom", label: "EMOM" },
  { v: "for_time", label: "For Time" },
  { v: "rounds", label: "A round" },
  { v: "tabata", label: "Tabata" },
  { v: "interval", label: "Intervalli" },
];

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

// ─── Endurance segment editor ─────────────────────────────────────────────────

function EnduranceEditor({
  seg,
  onChange,
}: {
  seg: EnduranceSegment;
  onChange: (s: EnduranceSegment) => void;
}) {
  const setSteps = (steps: EnduranceSegment["steps"]) => onChange({ ...seg, steps });
  const updateStep = (si: number, st: EnduranceSegment["steps"][number]) =>
    setSteps(seg.steps.map((x, i) => (i === si ? st : x)));
  const addStep = () => setSteps([...seg.steps, { reps: 1, work: { distanceM: 1000 } }]);
  const removeStep = (si: number) => setSteps(seg.steps.filter((_, i) => i !== si));

  return (
    <div className="space-y-2">
      <select
        value={seg.format}
        onChange={(e) => onChange({ ...seg, format: e.target.value as CardioFormat })}
        className={selectCls}
      >
        {CARDIO_FORMATS.map((f) => (
          <option key={f.v} value={f.v}>{f.label}</option>
        ))}
      </select>

      {seg.steps.map((st, si) => (
        <div key={si} className="rounded-lg border border-slate-700 bg-slate-900/40 p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[11px] text-slate-400">
              ×
              <input
                type="number" min={1} value={st.reps}
                onChange={(e) => updateStep(si, { ...st, reps: +e.target.value || 1 })}
                className={numCls}
              />
            </label>
            <input
              value={st.label ?? ""}
              onChange={(e) => updateStep(si, { ...st, label: e.target.value || undefined })}
              placeholder="Etichetta (es. Serie principale)"
              className={`${textCls} flex-1`}
            />
            {seg.steps.length > 1 && (
              <button type="button" onClick={() => removeStep(si)} className="text-slate-600 hover:text-red-400">✕</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <input type="number" placeholder="Distanza (m)" value={st.work.distanceM ?? ""}
              onChange={(e) => updateStep(si, { ...st, work: { ...st.work, distanceM: e.target.value ? +e.target.value : undefined } })}
              className={fieldCls} />
            <input type="number" placeholder="Durata (s)" value={st.work.durationSec ?? ""}
              onChange={(e) => updateStep(si, { ...st, work: { ...st.work, durationSec: e.target.value ? +e.target.value : undefined } })}
              className={fieldCls} />
            <input placeholder="Passo (es. 4:00/km)" value={st.work.targetPace ?? ""}
              onChange={(e) => updateStep(si, { ...st, work: { ...st.work, targetPace: e.target.value || undefined } })}
              className={fieldCls} />
            <input placeholder="FC/Zona (es. Z4)" value={st.work.targetHR ?? ""}
              onChange={(e) => updateStep(si, { ...st, work: { ...st.work, targetHR: e.target.value || undefined } })}
              className={fieldCls} />
            <input type="number" placeholder="Recupero (s)" value={st.recovery?.durationSec ?? ""}
              onChange={(e) => updateStep(si, { ...st, recovery: e.target.value ? { ...(st.recovery ?? {}), durationSec: +e.target.value } : undefined })}
              className={fieldCls} />
          </div>
        </div>
      ))}

      <button type="button" onClick={addStep} className="text-primary text-[11px] font-medium">+ Step</button>
    </div>
  );
}

// ─── Conditioning (hybrid) segment editor ─────────────────────────────────────

function ConditioningEditor({
  seg,
  onChange,
}: {
  seg: ConditioningSegment;
  onChange: (s: ConditioningSegment) => void;
}) {
  const setMoves = (movements: ConditioningSegment["movements"]) => onChange({ ...seg, movements });
  const updateMove = (mi: number, m: ConditioningSegment["movements"][number]) =>
    setMoves(seg.movements.map((x, i) => (i === mi ? m : x)));
  const addMove = () => setMoves([...seg.movements, { name: "" }]);
  const removeMove = (mi: number) => setMoves(seg.movements.filter((_, i) => i !== mi));

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap items-center text-[11px] text-slate-400">
        <select
          value={seg.structure}
          onChange={(e) => onChange({ ...seg, structure: e.target.value as ConditioningSegment["structure"] })}
          className={selectCls}
        >
          {STRUCTURES.map((s) => (
            <option key={s.v} value={s.v}>{s.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          Round
          <input type="number" min={1} value={seg.rounds ?? ""}
            onChange={(e) => onChange({ ...seg, rounds: e.target.value ? +e.target.value : undefined })}
            className={numCls} />
        </label>
        <label className="flex items-center gap-1">
          Cap (s)
          <input type="number" min={1} value={seg.timeCapSec ?? ""}
            onChange={(e) => onChange({ ...seg, timeCapSec: e.target.value ? +e.target.value : undefined })}
            className={numCls} />
        </label>
      </div>

      {seg.movements.map((m, mi) => (
        <div key={mi} className="rounded-lg border border-slate-700 bg-slate-900/40 p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input value={m.name} onChange={(e) => updateMove(mi, { ...m, name: e.target.value })}
              placeholder="Movimento (es. Wall ball / Run)" className={`${textCls} flex-1`} />
            {seg.movements.length > 1 && (
              <button type="button" onClick={() => removeMove(mi)} className="text-slate-600 hover:text-red-400">✕</button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <input placeholder="Reps" value={m.reps ?? ""}
              onChange={(e) => updateMove(mi, { ...m, reps: e.target.value || undefined })} className={fieldCls} />
            <input placeholder="Carico" value={m.load ?? ""}
              onChange={(e) => updateMove(mi, { ...m, load: e.target.value || undefined })} className={fieldCls} />
            <input type="number" placeholder="Dist (m)" value={m.distanceM ?? ""}
              onChange={(e) => updateMove(mi, { ...m, distanceM: e.target.value ? +e.target.value : undefined })} className={fieldCls} />
            <input type="number" placeholder="Durata (s)" value={m.durationSec ?? ""}
              onChange={(e) => updateMove(mi, { ...m, durationSec: e.target.value ? +e.target.value : undefined })} className={fieldCls} />
            <input type="number" placeholder="Cal" value={m.calories ?? ""}
              onChange={(e) => updateMove(mi, { ...m, calories: e.target.value ? +e.target.value : undefined })} className={fieldCls} />
            <input type="number" placeholder="Rec (s)" value={m.restSeconds ?? ""}
              onChange={(e) => updateMove(mi, { ...m, restSeconds: e.target.value ? +e.target.value : undefined })} className={fieldCls} />
          </div>
        </div>
      ))}

      <button type="button" onClick={addMove} className="text-primary text-[11px] font-medium">+ Movimento</button>
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

          {seg.kind === "strength" && <StrengthEditor seg={seg} onChange={(s) => update(i, s)} />}
          {seg.kind === "endurance" && <EnduranceEditor seg={seg} onChange={(s) => update(i, s)} />}
          {seg.kind === "conditioning" && <ConditioningEditor seg={seg} onChange={(s) => update(i, s)} />}
          {seg.kind === "rest" && (
            <p className="text-[11px] text-slate-500 italic px-1">Blocco di riposo</p>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        {([
          ["+ Forza", emptyStrengthSegment],
          ["+ Endurance", emptyEnduranceSegment],
          ["+ Conditioning", emptyConditioningSegment],
          ["+ Riposo", emptyRestSegment],
        ] as const).map(([label, make]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange([...segments, make()])}
            className="flex-1 min-w-[7rem] py-2 text-xs text-emerald-400 border border-dashed border-emerald-500/30 rounded-xl hover:border-emerald-500/60 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
