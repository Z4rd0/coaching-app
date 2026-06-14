"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getLogs } from "@/lib/firestore";
import type { WorkoutLog, Lap } from "@/types";
import { MOOD_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// ─── Pace helpers ─────────────────────────────────────────────────────────────

function paceToSec(pace: string): number {
  const [m, s] = pace.split(":").map(Number);
  return m * 60 + (s || 0);
}

function secToPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function bestPaceOfLaps(laps: Lap[]): string | null {
  const withPace = laps.filter((l) => l.avgPaceMinPerKm);
  if (!withPace.length) return null;
  return [...withPace].sort((a, b) => paceToSec(a.avgPaceMinPerKm!) - paceToSec(b.avgPaceMinPerKm!))[0]
    .avgPaceMinPerKm!;
}

function avgHROfLaps(laps: Lap[]): number | null {
  const withHR = laps.filter((l) => l.avgHR);
  if (!withHR.length) return null;
  return Math.round(withHR.reduce((s, l) => s + l.avgHR!, 0) / withHR.length);
}

// ─── Progression model ────────────────────────────────────────────────────────

interface SessionPoint {
  date: Date;
  logId: string;
  bestPaceSec: number;
  bestPaceStr: string;
  avgHR: number | null;
  lapCount: number;
  avgLapDistM: number;
}

interface ProgressionSeries {
  title: string;
  points: SessionPoint[];
}

function buildProgression(logs: WorkoutLog[]): ProgressionSeries[] {
  const withLaps = logs
    .filter((l) => l.laps && l.laps.length > 0 && l.laps.some((lap) => lap.avgPaceMinPerKm))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());

  const groups = new Map<string, WorkoutLog[]>();
  for (const log of withLaps) {
    // Group key: session title or lap-distance bucket (rounded 100m)
    const avgDist = Math.round(
      log.laps!.reduce((s, l) => s + l.distanceM, 0) / log.laps!.length / 100
    ) * 100;
    const key = log.plannedSession?.title ?? `${log.laps!.length}×${avgDist}m`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(log);
  }

  return Array.from(groups.entries())
    .filter(([, g]) => g.length >= 2)
    .map(([title, g]) => ({
      title,
      points: g.map((log) => {
        const bp = bestPaceOfLaps(log.laps!);
        const avgDist = Math.round(log.laps!.reduce((s, l) => s + l.distanceM, 0) / log.laps!.length);
        return {
          date: log.date.toDate(),
          logId: log.id,
          bestPaceSec: bp ? paceToSec(bp) : 0,
          bestPaceStr: bp ?? "",
          avgHR: avgHROfLaps(log.laps!),
          lapCount: log.laps!.length,
          avgLapDistM: avgDist,
        };
      }),
    }));
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ points }: { points: SessionPoint[] }) {
  const paces = points.map((p) => p.bestPaceSec).filter((p) => p > 0);
  if (paces.length < 2) return null;

  const W = 100;
  const H = 28;
  const pad = 3;
  const minP = Math.min(...paces);
  const maxP = Math.max(...paces);
  const range = maxP - minP || 1;

  // Lower pace = better = higher on chart (inverted Y)
  const pts = paces.map((p, i) => {
    const x = pad + (i / (paces.length - 1)) * (W - pad * 2);
    const y = H - pad - ((maxP - p) / range) * (H - pad * 2);
    return [x, y] as [number, number];
  });

  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const improving = paces[paces.length - 1] < paces[paces.length - 2];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={d} fill="none" stroke={improving ? "#1D9E75" : "#94a3b8"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={improving ? "#1D9E75" : "#94a3b8"} />
    </svg>
  );
}

// ─── Progression card ────────────────────────────────────────────────────────

function ProgressionCard({ series }: { series: ProgressionSeries }) {
  const { points } = series;
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const delta = last.bestPaceSec - prev.bestPaceSec; // negative = faster = better
  const deltaStr = Math.abs(delta) > 0 ? secToPace(Math.abs(delta)) : null;
  const improved = delta < 0;

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{series.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {last.lapCount} lap · ~{last.avgLapDistM >= 1000
              ? `${(last.avgLapDistM / 1000).toFixed(1)} km`
              : `${last.avgLapDistM} m`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-black tabular-nums" style={{ color: "var(--green-primary)" }}>
            {last.bestPaceStr}
          </p>
          <p className="text-[10px] text-slate-500">miglior passo</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Sparkline points={points} />

        <div className="text-right shrink-0 space-y-1">
          {deltaStr && (
            <p className={`text-xs font-semibold ${improved ? "text-green-400" : "text-slate-400"}`}>
              {improved ? "↑" : "↓"} {deltaStr}/km
              <span className="ml-1 font-normal text-slate-500">vs precedente</span>
            </p>
          )}
          {last.avgHR && (
            <p className="text-xs text-slate-500">
              FC media intervalli: <span className="text-white font-medium">{last.avgHR} bpm</span>
            </p>
          )}
          {prev.avgHR && last.avgHR && (
            <p className={`text-[11px] ${last.avgHR < prev.avgHR ? "text-green-400" : "text-slate-400"}`}>
              {last.avgHR < prev.avgHR
                ? `↓ ${prev.avgHR - last.avgHR} bpm FC`
                : `↑ ${last.avgHR - prev.avgHR} bpm FC`}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
        {points.map((p, i) => (
          <Link
            key={p.logId}
            href={`/athlete/history/${p.logId}`}
            className="shrink-0 text-center px-2 py-1 rounded-lg border transition-colors"
            style={{
              borderColor: i === points.length - 1 ? "var(--green-primary)" : "rgba(148,163,184,0.1)",
              background: i === points.length - 1 ? "rgba(29,158,117,0.08)" : "transparent",
            }}
          >
            <p className="text-[10px] text-slate-500">{format(p.date, "d/M")}</p>
            <p className="text-[11px] font-semibold tabular-nums" style={{
              color: i === points.length - 1 ? "var(--green-primary)" : "var(--text-muted)",
            }}>
              {p.bestPaceStr}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AthleteHistoryPage() {
  const { user, athleteAccess } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !athleteAccess) return;
    const { coachId, athleteId } = athleteAccess;
    getLogs(coachId, athleteId, 50).then(setLogs).finally(() => setLoading(false));
  }, [user, athleteAccess]);

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  const progression = buildProgression(logs);

  return (
    <div className="px-4 pt-6 pb-8 space-y-6">
      <h1 className="text-xl font-bold text-white">Storico allenamenti</h1>

      {/* Progressione ripetute */}
      {progression.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            📈 Progressione ripetute
          </p>
          <div className="space-y-3">
            {progression.map((s) => (
              <ProgressionCard key={s.title} series={s} />
            ))}
          </div>
        </section>
      )}

      {/* Log list */}
      {logs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">Nessun allenamento loggato ancora.</p>
        </div>
      ) : (
        <section>
          {progression.length > 0 && (
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Tutti gli allenamenti
            </p>
          )}
          <div className="space-y-3">
            {logs.map((log) => (
              <Link
                key={log.id}
                href={`/athlete/history/${log.id}`}
                className="block bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden hover:border-slate-600 transition-colors"
              >
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {format(log.date.toDate(), "EEEE d MMMM yyyy", { locale: it })}
                      </p>
                      {log.plannedSession?.title && (
                        <p className="text-primary text-xs mt-0.5">{log.plannedSession.title}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {log.laps && log.laps.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          {log.laps.length} lap
                        </span>
                      )}
                      <span className="text-xl">{MOOD_LABELS[log.mood]}</span>
                    </div>
                  </div>

                  <div className="flex gap-4 text-xs text-slate-400 mt-2">
                    <span>RPE {log.perceivedRPE}/10</span>
                    <span>{log.actualDurationMin} min</span>
                    {log.laps && bestPaceOfLaps(log.laps) && (
                      <span className="text-primary font-medium">
                        best {bestPaceOfLaps(log.laps)}/km
                      </span>
                    )}
                    {log.writtenBy && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                        {log.writtenBy === "athlete" ? "Tu" : "Coach"}
                      </span>
                    )}
                  </div>

                  {log.notes && (
                    <p className="text-slate-400 text-xs mt-2 line-clamp-2">{log.notes}</p>
                  )}

                  {log.coachComment && (
                    <div className="mt-3 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                      <p className="text-xs text-primary font-medium mb-0.5">💬 Dal tuo coach</p>
                      <p className="text-xs text-slate-300">{log.coachComment}</p>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
