import type { WorkoutLog } from "@/types";

/**
 * Personal records from what the athlete already logs.
 *
 * The hard part isn't the maths, it's that loads are free text: "80kg", "80 kg",
 * "2x24kg", "bodyweight", "70% 1RM". Anything unparseable is skipped rather than
 * guessed — a wrong PR is worse than a missing one, because the athlete will
 * believe it.
 */

/** Kilograms in a load string, or null when it isn't an absolute weight.
 *
 *  Percentages ("70% 1RM") are relative to a max we don't know, and bodyweight
 *  work has no number at all — both are excluded on purpose. */
export function parseLoadKg(raw?: string): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (s === "" || s.includes("%")) return null;

  // "2x24kg" / "2 × 24 kg" → per-side dumbbells: take the total.
  const pair = s.match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(kg|lb|lbs)?/);
  if (pair) {
    const count = parseFloat(pair[1].replace(",", "."));
    const each = parseFloat(pair[2].replace(",", "."));
    if (!Number.isFinite(count) || !Number.isFinite(each)) return null;
    const kg = pair[3] === "lb" || pair[3] === "lbs" ? each * 0.4536 : each;
    return Math.round(count * kg * 10) / 10;
  }

  const single = s.match(/(\d+(?:[.,]\d+)?)\s*(kg|lb|lbs)?/);
  if (!single) return null;
  const n = parseFloat(single[1].replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  // A bare number is assumed to be kg — the app's own placeholders use kg.
  const kg = single[2] === "lb" || single[2] === "lbs" ? n * 0.4536 : n;
  return Math.round(kg * 10) / 10;
}

/** Total reps behind a rep string ("8", "8-10" → 8, "AMRAP" → null). */
export function parseReps(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface ExerciseRecord {
  exercise: string;
  loadKg: number;
  reps: number | null;
  date: Date;
  logId: string;
}

export type RecordWindow = "3m" | "1y" | "all";

const WINDOW_DAYS: Record<RecordWindow, number | null> = {
  "3m": 90,
  "1y": 365,
  all: null,
};

function inWindow(date: Date, window: RecordWindow, now: Date): boolean {
  const days = WINDOW_DAYS[window];
  if (days === null) return true;
  return now.getTime() - date.getTime() <= days * 86_400_000;
}

/** Heaviest logged set per exercise within a window, best first. */
export function exerciseRecords(
  logs: (Pick<WorkoutLog, "date" | "exerciseLogs"> & { id: string })[],
  window: RecordWindow = "all",
  now: Date = new Date()
): ExerciseRecord[] {
  const best = new Map<string, ExerciseRecord>();

  for (const log of logs) {
    const date = log.date?.toDate?.();
    if (!date || !inWindow(date, window, now)) continue;

    for (const ex of log.exerciseLogs ?? []) {
      const name = (ex.name ?? "").trim();
      if (!name) continue;
      const loadKg = parseLoadKg(ex.actualLoad ?? ex.plannedLoad);
      if (loadKg === null) continue;

      const key = name.toLowerCase();
      const current = best.get(key);
      if (!current || loadKg > current.loadKg) {
        best.set(key, {
          exercise: name,
          loadKg,
          reps: parseReps(ex.actualReps ?? ex.plannedReps),
          date,
          logId: log.id,
        });
      }
    }
  }

  return Array.from(best.values()).sort((a, b) => b.loadKg - a.loadKg);
}

/**
 * Exercises in `log` that beat every earlier log — i.e. the records this
 * workout set. Compared against the athlete's whole history, not a window, so
 * "nuovo record" always means what it says.
 */
export function recordsSetBy(
  log: Pick<WorkoutLog, "date" | "exerciseLogs"> & { id: string },
  history: (Pick<WorkoutLog, "date" | "exerciseLogs"> & { id: string })[]
): { exercise: string; loadKg: number; previousKg: number | null }[] {
  const logDate = log.date?.toDate?.();
  if (!logDate) return [];

  // Everything strictly before this log — a later session can't invalidate a
  // record that was genuinely new when it happened.
  const earlier = history.filter((h) => {
    const d = h.date?.toDate?.();
    return d && h.id !== log.id && d.getTime() < logDate.getTime();
  });
  const previous = new Map(
    exerciseRecords(earlier, "all").map((r) => [r.exercise.toLowerCase(), r.loadKg])
  );

  const out: { exercise: string; loadKg: number; previousKg: number | null }[] = [];
  const seen = new Set<string>();

  for (const ex of log.exerciseLogs ?? []) {
    const name = (ex.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    const loadKg = parseLoadKg(ex.actualLoad ?? ex.plannedLoad);
    if (loadKg === null) continue;

    const prev = previous.get(key) ?? null;
    if (prev === null || loadKg > prev) {
      seen.add(key);
      out.push({ exercise: name, loadKg, previousKg: prev });
    }
  }

  return out;
}
