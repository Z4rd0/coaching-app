"use client";

import type { Segment, SegmentLog, ExerciseLog, CardioLog, CircuitLog } from "@/types";

const inputCls =
  "w-full rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors focus:ring-1 focus:ring-[var(--green-primary)]" +
  " bg-[var(--bg-surface-2)] border border-[rgba(148,163,184,0.08)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)]";

const STRUCTURE_LABEL: Record<string, string> = {
  amrap: "AMRAP",
  emom: "EMOM",
  for_time: "For Time",
  rounds: "A round",
  tabata: "Tabata",
  interval: "Intervalli",
};

/** Blank actuals for a segment, pre-filled from the plan where that helps. */
export function initSegmentLogs(segments: Segment[]): SegmentLog[] {
  return segments.map((seg) => {
    const base = { segmentId: seg.id, kind: seg.kind } as SegmentLog;
    if (seg.kind === "strength") {
      const exerciseLogs: ExerciseLog[] = seg.groups.flatMap((g) =>
        g.items.map((ex) => ({
          name: ex.name,
          plannedSets: ex.sets,
          plannedReps: ex.reps,
          plannedLoad: ex.load,
          actualSets: ex.sets,
          actualReps: ex.reps,
          actualLoad: ex.load,
          notes: "",
        }))
      );
      return { ...base, exerciseLogs };
    }
    if (seg.kind === "endurance") return { ...base, cardioLog: {} };
    if (seg.kind === "conditioning") {
      return { ...base, conditioningLog: { roundsCompleted: seg.rounds ?? 1 } };
    }
    return base;
  });
}

/** Drop empty actuals so a half-filled hybrid doesn't write noise to Firestore. */
export function pruneSegmentLogs(logs: SegmentLog[]): SegmentLog[] {
  const filled = (o?: object) =>
    !!o && Object.values(o).some((v) => v !== undefined && v !== "" && v !== null);
  return logs.filter(
    (l) =>
      (l.exerciseLogs && l.exerciseLogs.length > 0) ||
      filled(l.cardioLog) ||
      filled(l.conditioningLog) ||
      (l.notes ?? "") !== ""
  );
}

/**
 * Per-block actuals for a hybrid session (MIGRATION_SEGMENTS.md §6).
 *
 * Until now a hybrid could only be logged with session-level metrics — duration,
 * RPE, mood — while the plan was shown read-only beside it, so "5 round di X poi
 * 3 km" came back as a single undifferentiated number. Each segment now gets the
 * inputs its kind actually needs, keyed by the segment id so plan and actuals
 * stay aligned even after the coach edits the program.
 */
export default function SegmentLogEditor({
  segments,
  value,
  onChange,
}: {
  segments: Segment[];
  value: SegmentLog[];
  onChange: (next: SegmentLog[]) => void;
}) {
  const patch = (i: number, p: Partial<SegmentLog>) =>
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...p } : l)));

  const patchExercise = (i: number, exIdx: number, p: Partial<ExerciseLog>) =>
    patch(i, {
      exerciseLogs: (value[i].exerciseLogs ?? []).map((el, k) =>
        k === exIdx ? { ...el, ...p } : el
      ),
    });

  const patchCardio = (i: number, p: Partial<CardioLog>) =>
    patch(i, { cardioLog: { ...(value[i].cardioLog ?? {}), ...p } });

  const patchConditioning = (i: number, p: Partial<CircuitLog>) =>
    patch(i, {
      conditioningLog: { ...(value[i].conditioningLog ?? { roundsCompleted: 0 }), ...p },
    });

  const num = (v: string) => (v === "" ? undefined : +v);

  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        const log = value[i];
        if (!log) return null;
        const heading = seg.title || STRUCTURE_LABEL[(seg as { structure?: string }).structure ?? ""] || `Blocco ${i + 1}`;

        return (
          <div key={seg.id} className="card p-4 space-y-3">
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {heading}
            </p>

            {seg.kind === "strength" && (
              <div className="space-y-2">
                {(log.exerciseLogs ?? []).map((ex, k) => (
                  <div key={k} className="space-y-1.5">
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {ex.name}
                      {ex.plannedSets != null && (
                        <span style={{ color: "var(--text-faint)" }}>
                          {" "}· piano {ex.plannedSets}×{ex.plannedReps}
                          {ex.plannedLoad ? ` @ ${ex.plannedLoad}` : ""}
                        </span>
                      )}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number" min={0} placeholder="serie"
                        value={ex.actualSets ?? ""}
                        onChange={(e) => patchExercise(i, k, { actualSets: num(e.target.value) })}
                        className={inputCls}
                      />
                      <input
                        placeholder="ripetizioni"
                        value={ex.actualReps ?? ""}
                        onChange={(e) => patchExercise(i, k, { actualReps: e.target.value })}
                        className={inputCls}
                      />
                      <input
                        placeholder="carico"
                        value={ex.actualLoad ?? ""}
                        onChange={(e) => patchExercise(i, k, { actualLoad: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {seg.kind === "endurance" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number" min={0} step="0.01" placeholder="distanza (km)"
                  value={log.cardioLog?.distanceMeters != null ? log.cardioLog.distanceMeters / 1000 : ""}
                  onChange={(e) =>
                    patchCardio(i, {
                      distanceMeters: e.target.value === "" ? undefined : Math.round(+e.target.value * 1000),
                    })
                  }
                  className={inputCls}
                />
                <input
                  placeholder="passo medio (4:30)"
                  value={log.cardioLog?.avgPaceMinPerKm ?? ""}
                  onChange={(e) => patchCardio(i, { avgPaceMinPerKm: e.target.value })}
                  className={inputCls}
                />
                <input
                  type="number" min={0} placeholder="FC media"
                  value={log.cardioLog?.avgHeartRate ?? ""}
                  onChange={(e) => patchCardio(i, { avgHeartRate: num(e.target.value) })}
                  className={inputCls}
                />
                <input
                  type="number" min={0} placeholder="FC max"
                  value={log.cardioLog?.maxHeartRate ?? ""}
                  onChange={(e) => patchCardio(i, { maxHeartRate: num(e.target.value) })}
                  className={inputCls}
                />
              </div>
            )}

            {seg.kind === "conditioning" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number" min={0} placeholder="round completati"
                  value={log.conditioningLog?.roundsCompleted ?? ""}
                  onChange={(e) => patchConditioning(i, { roundsCompleted: num(e.target.value) ?? 0 })}
                  className={inputCls}
                />
                <input
                  type="number" min={0} placeholder="FC media"
                  value={log.conditioningLog?.avgHeartRate ?? ""}
                  onChange={(e) => patchConditioning(i, { avgHeartRate: num(e.target.value) })}
                  className={inputCls}
                />
              </div>
            )}

            <input
              placeholder="Note sul blocco"
              value={log.notes ?? ""}
              onChange={(e) => patch(i, { notes: e.target.value })}
              className={inputCls}
            />
          </div>
        );
      })}
    </div>
  );
}
