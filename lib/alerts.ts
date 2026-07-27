import type { WorkoutLog } from "@/types";
import type { LoadSummary } from "@/lib/load";
import { ACWR_ALERT_MIN, ACWR_ALERT_MAX } from "@/lib/load";

/**
 * The alert engine behind the coach dashboard's "Da monitorare".
 *
 * The point is to answer "who needs me today?" without the coach opening every
 * athlete. Each alert carries the reason that produced it, because a bare red
 * dot ("something is off with Marco") costs a tap to interpret and teaches the
 * coach nothing — the reference product's tooltip does exactly this.
 *
 * Pure: takes already-loaded data, returns what to show.
 */

export type AlertKind = "inactivity" | "load" | "adherence" | "silence";

export interface AlertThresholds {
  /** Days without a single log before flagging. */
  inactivityDays: number;
  /** Acute:chronic band considered safe. */
  acwrMin: number;
  acwrMax: number;
  /** Logged/planned percentage below which adherence is flagged. */
  adherenceMinPct: number;
  /** Days without any note from the athlete before flagging. */
  silenceDays: number;
  /** Per-kind on/off, so a coach can silence what they don't care about. */
  enabled: Record<AlertKind, boolean>;
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  inactivityDays: 5,
  acwrMin: ACWR_ALERT_MIN,
  acwrMax: ACWR_ALERT_MAX,
  adherenceMinPct: 70,
  silenceDays: 10,
  enabled: { inactivity: true, load: true, adherence: true, silence: true },
};

/** Merge stored settings over the defaults, tolerating partial/legacy shapes. */
export function resolveThresholds(stored: unknown): AlertThresholds {
  const s = (stored ?? {}) as Partial<AlertThresholds>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    inactivityDays: num(s.inactivityDays, DEFAULT_THRESHOLDS.inactivityDays),
    acwrMin: num(s.acwrMin, DEFAULT_THRESHOLDS.acwrMin),
    acwrMax: num(s.acwrMax, DEFAULT_THRESHOLDS.acwrMax),
    adherenceMinPct: num(s.adherenceMinPct, DEFAULT_THRESHOLDS.adherenceMinPct),
    silenceDays: num(s.silenceDays, DEFAULT_THRESHOLDS.silenceDays),
    enabled: { ...DEFAULT_THRESHOLDS.enabled, ...(s.enabled ?? {}) },
  };
}

export interface CoachAlert {
  kind: AlertKind;
  severity: "warning" | "critical";
  /** One-glance label, e.g. "Fermo da 9 giorni". */
  label: string;
  /** The reason, spelled out for the drill-down. */
  detail: string;
}

export interface AlertInput {
  /** Logs used for load/silence checks — the last ~28 days is enough. */
  logs: Pick<WorkoutLog, "date" | "notes">[];
  lastLogDate: Date | null;
  load: LoadSummary;
  /** Sessions the program planned in the last 7 days. */
  plannedLast7: number;
  /** Sessions actually logged in the last 7 days. */
  loggedLast7: number;
  thresholds: AlertThresholds;
  now?: Date;
}

const daysBetween = (from: Date, to: Date) =>
  Math.floor((to.getTime() - from.getTime()) / 86_400_000);

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function buildAlerts(input: AlertInput): CoachAlert[] {
  const { logs, lastLogDate, load, plannedLast7, loggedLast7, thresholds: t } = input;
  const now = input.now ?? new Date();
  const alerts: CoachAlert[] = [];

  // ── Inactivity ──
  if (t.enabled.inactivity) {
    const days = lastLogDate ? daysBetween(lastLogDate, now) : null;
    if (days === null) {
      alerts.push({
        kind: "inactivity",
        severity: "warning",
        label: "Nessun allenamento registrato",
        detail: "Questo atleta non ha ancora registrato nessun allenamento.",
      });
    } else if (days >= t.inactivityDays) {
      alerts.push({
        kind: "inactivity",
        severity: days >= t.inactivityDays * 2 ? "critical" : "warning",
        label: `Fermo da ${days} ${plural(days, "giorno", "giorni")}`,
        detail: `Ultimo allenamento ${days} ${plural(days, "giorno", "giorni")} fa (soglia: ${t.inactivityDays}).`,
      });
    }
  }

  // ── Training load (ACWR) ──
  // Skipped when the ratio is unknown: an athlete without 4 weeks of history
  // would otherwise be permanently flagged for something they can't fix.
  if (t.enabled.load && load.acwr !== null) {
    if (load.acwr > t.acwrMax) {
      alerts.push({
        kind: "load",
        severity: load.acwr > t.acwrMax * 1.3 ? "critical" : "warning",
        label: `Carico in salita (${load.acwr})`,
        detail:
          `Il carico dell'ultima settimana è ${load.acwr}× la media delle ultime 4 ` +
          `(soglia ${t.acwrMax}). Aumento rapido: rischio di sovraccarico.`,
      });
    } else if (load.acwr < t.acwrMin) {
      alerts.push({
        kind: "load",
        severity: "warning",
        label: `Carico in calo (${load.acwr})`,
        detail:
          `Il carico dell'ultima settimana è ${load.acwr}× la media delle ultime 4 ` +
          `(soglia ${t.acwrMin}). Sta perdendo condizione.`,
      });
    }
  }

  // ── Adherence ──
  // Only meaningful when something was actually planned.
  if (t.enabled.adherence && plannedLast7 > 0) {
    const pct = Math.round((loggedLast7 / plannedLast7) * 100);
    if (pct < t.adherenceMinPct) {
      alerts.push({
        kind: "adherence",
        severity: pct < t.adherenceMinPct / 2 ? "critical" : "warning",
        label: `Aderenza ${pct}%`,
        detail:
          `${loggedLast7} ${plural(loggedLast7, "sessione svolta", "sessioni svolte")} ` +
          `su ${plannedLast7} programmate negli ultimi 7 giorni (soglia ${t.adherenceMinPct}%).`,
      });
    }
  }

  // ── Silence ──
  if (t.enabled.silence) {
    const lastNote = logs
      .filter((l) => (l.notes ?? "").trim() !== "")
      .map((l) => l.date?.toDate?.())
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const days = lastNote ? daysBetween(lastNote, now) : null;
    if (days !== null && days >= t.silenceDays) {
      alerts.push({
        kind: "silence",
        severity: "warning",
        label: `Nessuna nota da ${days} giorni`,
        detail: `L'ultima nota dell'atleta risale a ${days} giorni fa (soglia ${t.silenceDays}).`,
      });
    }
  }

  return alerts;
}

/** Worst severity first, so the dashboard sorts by "who needs me most". */
export function alertRank(alerts: CoachAlert[]): number {
  if (alerts.some((a) => a.severity === "critical")) return 2;
  if (alerts.length > 0) return 1;
  return 0;
}

export const ALERT_LABELS: Record<AlertKind, string> = {
  inactivity: "Inattività",
  load: "Carico",
  adherence: "Aderenza",
  silence: "Silenzio",
};
