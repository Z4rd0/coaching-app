"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, subDays, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import dynamic from "next/dynamic";

const RPEChart = dynamic(() => import("@/components/RPEChart"), {
  ssr: false,
  loading: () => <div className="h-[160px] skeleton rounded-xl" />,
});

import { useAuth } from "@/contexts/AuthContext";
import { getLogs, getPrograms } from "@/lib/firestore";
import type { WorkoutLog, Program } from "@/types";
import { MOOD_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

type FilterType = "all" | "strength" | "cardio" | "mobility" | "other";

const FILTER_LABELS: Record<FilterType, string> = {
  all:      "Tutti",
  strength: "Forza",
  cardio:   "Cardio",
  mobility: "Mobilità",
  other:    "Altro",
};

const RPE_COLOR = (rpe: number) => {
  if (rpe <= 3) return "#22C55E";
  if (rpe <= 5) return "#84CC16";
  if (rpe <= 7) return "#EAB308";
  if (rpe <= 8) return "#F97316";
  return "#EF4444";
};

export default function HistoryPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [programMap, setProgramMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getLogs(user.uid, user.uid, 50),
      getPrograms(user.uid),
    ]).then(([logData, programs]: [WorkoutLog[], Program[]]) => {
      setLogs(logData);
      const map: Record<string, string> = {};
      for (const p of programs) map[p.id] = p.name;
      setProgramMap(map);
      setLoading(false);
    });
  }, [user]);

  const filtered = filter === "all" ? logs : logs.filter((l) => l.plannedSession?.type === filter);

  const chartData = [...logs]
    .slice(0, 14)
    .reverse()
    .map((l) => ({
      date: format(l.date.toDate(), "d/M"),
      rpe: l.perceivedRPE,
      target: l.plannedSession?.targetRPE ?? null,
    }));

  const weeklyData = Array.from({ length: 4 }).map((_, i) => {
    const weekStart = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const count = logs.filter((l) => {
      const d = l.date.toDate();
      return d >= weekStart && d < weekEnd;
    }).length;
    return { week: i === 0 ? "Questa" : i === 1 ? "Scorsa" : `-${i}w`, count };
  }).reverse();

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-5 pt-6 pb-8 space-y-6">
      <h1 className="text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>Storico</h1>

      {logs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
            Nessun allenamento ancora
          </p>
        </div>
      ) : (
        <>
          {/* RPE Trend */}
          {chartData.length > 1 && (
            <section>
              <h2 className="section-label mb-3">Trend RPE</h2>
              <div className="card p-4">
                <RPEChart data={chartData} />
                <div className="flex gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                    <span className="w-3 h-0.5 inline-block rounded" style={{ background: "var(--green-primary)" }} />
                    RPE effettivo
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                    <span className="w-3 h-0.5 inline-block rounded" style={{ background: "var(--text-faintest)" }} />
                    Target
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Weekly frequency */}
          <section>
            <h2 className="section-label mb-3">Frequenza settimanale</h2>
            <div className="grid grid-cols-4 gap-2">
              {weeklyData.map((w) => (
                <div key={w.week} className="card px-2 py-3 text-center">
                  <p className="text-[22px] font-black tabular" style={{ color: "var(--text-primary)" }}>
                    {w.count}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>{w.week}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {(["all", "strength", "cardio", "mobility", "other"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="shrink-0 text-[12px] font-semibold px-3.5 py-1.5 rounded-full transition-all"
                style={
                  filter === f
                    ? { background: "var(--green-primary)", color: "#fff" }
                    : { background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", color: "var(--text-muted)" }
                }
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Log list */}
          <section className="space-y-2">
            {filtered.length === 0 && (
              <p className="text-[13px] text-center py-8" style={{ color: "var(--text-muted)" }}>
                Nessun log per questo filtro
              </p>
            )}
            {filtered.map((log) => (
              <Link
                key={log.id}
                href={`/history/${log.id}`}
                className="flex items-center gap-3 card-2 px-4 py-3 active:opacity-70 transition-opacity"
              >
                <span className="text-[22px]">{MOOD_LABELS[log.mood]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {log.plannedSession?.title || "Sessione libera"}
                  </p>
                  {log.programId && programMap[log.programId] && (
                    <p className="text-[11px] font-medium truncate" style={{ color: "var(--green-primary)" }}>
                      {programMap[log.programId]}
                    </p>
                  )}
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                    {format(log.date.toDate(), "EEE d MMM", { locale: it })} · {log.actualDurationMin} min
                  </p>
                </div>
                <span
                  className="text-[16px] font-black tabular shrink-0"
                  style={{ color: RPE_COLOR(log.perceivedRPE) }}
                >
                  {log.perceivedRPE}
                </span>
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
