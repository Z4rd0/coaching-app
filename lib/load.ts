import type { WorkoutLog } from "@/types";
import { toLocalISODate } from "@/lib/dates";

/**
 * Training load from session-RPE (Foster).
 *
 * The reference product computes TRIMP from heart-rate zones, which needs a
 * reliable HR trace on every session — we don't have that, and it says nothing
 * about strength work. Session-RPE (`load = RPE × minutes`) is a validated
 * method that runs on exactly the two numbers every log already carries, and it
 * applies to lifting as much as to running.
 *
 * Everything here is pure: no Firestore, no dates beyond what's passed in.
 */

/** Foster session load for one workout: RPE (1-10) × duration in minutes. */
export function sessionLoad(log: Pick<WorkoutLog, "perceivedRPE" | "actualDurationMin">): number {
  const rpe = Number.isFinite(log.perceivedRPE) ? log.perceivedRPE : 0;
  const min = Number.isFinite(log.actualDurationMin) ? log.actualDurationMin : 0;
  if (rpe <= 0 || min <= 0) return 0;
  return rpe * min;
}

export interface DailyLoad {
  /** Local ISO day "YYYY-MM-DD". */
  date: string;
  load: number;
}

/** Per-day totals over `days` ending at `end` (inclusive), zero-filled.
 *
 *  Zero-filling matters: rest days are part of the training week, and an average
 *  taken only over days that happen to have a log would read a single hard
 *  session in a quiet week as a huge chronic load. */
export function dailyLoads(
  logs: Pick<WorkoutLog, "perceivedRPE" | "actualDurationMin" | "date">[],
  days: number,
  end: Date = new Date()
): DailyLoad[] {
  const byDay = new Map<string, number>();
  for (const log of logs) {
    const d = log.date?.toDate?.();
    if (!d) continue;
    const key = toLocalISODate(d);
    byDay.set(key, (byDay.get(key) ?? 0) + sessionLoad(log));
  }

  const out: DailyLoad[] = [];
  const cursor = new Date(end);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const key = toLocalISODate(cursor);
    out.push({ date: key, load: byDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length === 0 ? 0 : sum(xs) / xs.length);

function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

export interface LoadSummary {
  /** Total load over the last 7 days. */
  weekLoad: number;
  /** Mean daily load over the last 7 days. */
  acute: number;
  /** Mean daily load over the last 28 days. */
  chronic: number;
  /** Acute:chronic workload ratio, or null when there isn't enough history. */
  acwr: number | null;
  /** Weekly monotony (mean / SD of daily loads): high = every day the same. */
  monotony: number | null;
  /** Weekly strain (weekLoad × monotony). */
  strain: number | null;
  /** How to read the ACWR. "unknown" when acwr is null. */
  status: LoadStatus;
}

export type LoadStatus = "unknown" | "detraining" | "optimal" | "overreaching";

/** Range treated as the safe zone. Matches the reference product's default
 *  0.5–1.5 alert band; kept here so the alert engine and the UI agree. */
export const ACWR_MIN = 0.8;
export const ACWR_MAX = 1.3;
/** Wider band used to flag an alert (vs. merely leaving the ideal window). */
export const ACWR_ALERT_MIN = 0.5;
export const ACWR_ALERT_MAX = 1.5;

export function acwrStatus(acwr: number | null): LoadStatus {
  if (acwr === null) return "unknown";
  if (acwr < ACWR_MIN) return "detraining";
  if (acwr > ACWR_MAX) return "overreaching";
  return "optimal";
}

/**
 * Load picture for one athlete.
 *
 * `chronic` needs a real 28-day window to mean anything: with only a few days of
 * history the ratio is dominated by noise and would raise alarms on athletes who
 * simply just started. `acwr` stays null until there is something to compare —
 * callers must render "—", never a number they'd act on.
 */
export function loadSummary(
  logs: Pick<WorkoutLog, "perceivedRPE" | "actualDurationMin" | "date">[],
  end: Date = new Date()
): LoadSummary {
  const last28 = dailyLoads(logs, 28, end);
  const last7 = last28.slice(-7);

  const weekLoad = sum(last7.map((d) => d.load));
  const acute = mean(last7.map((d) => d.load));
  const chronic = mean(last28.map((d) => d.load));

  const acwr = chronic > 0 ? acute / chronic : null;

  const sd = stdDev(last7.map((d) => d.load));
  const monotony = sd > 0 ? acute / sd : null;
  const strain = monotony !== null ? weekLoad * monotony : null;

  return {
    weekLoad: Math.round(weekLoad),
    acute: Math.round(acute),
    chronic: Math.round(chronic),
    acwr: acwr === null ? null : Math.round(acwr * 100) / 100,
    monotony: monotony === null ? null : Math.round(monotony * 100) / 100,
    strain: strain === null ? null : Math.round(strain),
    status: acwrStatus(acwr === null ? null : Math.round(acwr * 100) / 100),
  };
}

/** Weekly load series (oldest → newest) for charting, `weeks` buckets of 7 days. */
export function weeklyLoadSeries(
  logs: Pick<WorkoutLog, "perceivedRPE" | "actualDurationMin" | "date">[],
  weeks = 8,
  end: Date = new Date()
): { weekStart: string; load: number }[] {
  const days = dailyLoads(logs, weeks * 7, end);
  const out: { weekStart: string; load: number }[] = [];
  for (let i = 0; i < weeks; i++) {
    const bucket = days.slice(i * 7, i * 7 + 7);
    if (bucket.length === 0) continue;
    out.push({ weekStart: bucket[0].date, load: Math.round(sum(bucket.map((d) => d.load))) });
  }
  return out;
}
