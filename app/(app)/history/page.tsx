"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, subDays, startOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { getLogs } from "@/lib/firestore";
import type { WorkoutLog } from "@/types";
import { SESSION_TYPE_LABELS, MOOD_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

type FilterType = "all" | "strength" | "cardio" | "mobility" | "other";

export default function HistoryPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    if (!user) return;
    getLogs(user.uid, user.uid, 50).then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, [user]);

  const filtered = filter === "all"
    ? logs
    : logs.filter((l) => l.plannedSession?.type === filter);

  // RPE trend chart data (last 14 entries, chronological)
  const chartData = [...logs]
    .slice(0, 14)
    .reverse()
    .map((l) => ({
      date: format(l.date.toDate(), "d/M"),
      rpe: l.perceivedRPE,
      target: l.plannedSession?.targetRPE ?? null,
    }));

  // Weekly frequency: count logs per week for last 4 weeks
  const weeklyData = Array.from({ length: 4 }).map((_, i) => {
    const weekStart = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 });
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const count = logs.filter((l) => {
      const d = l.date.toDate();
      return d >= weekStart && d < weekEnd;
    }).length;
    return {
      week: i === 0 ? "Questa" : i === 1 ? "Scorsa" : `-${i}w`,
      count,
    };
  }).reverse();

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-4 pt-6 pb-8 space-y-6">
      <h1 className="text-xl font-bold text-white">Storico</h1>

      {logs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-slate-400">Nessun allenamento ancora</p>
        </div>
      ) : (
        <>
          {/* RPE Trend */}
          {chartData.length > 1 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Trend RPE
              </h2>
              <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <YAxis domain={[1, 10]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
                      labelStyle={{ color: "#94a3b8" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rpe"
                      stroke="#1D9E75"
                      strokeWidth={2}
                      dot={{ fill: "#1D9E75", r: 3 }}
                      name="RPE effettivo"
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="#64748b"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      name="Target"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <span className="w-3 h-0.5 bg-primary inline-block" /> RPE effettivo
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <span className="w-3 h-0.5 bg-slate-500 inline-block" /> Target
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Weekly frequency */}
          <section>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Frequenza settimanale
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {weeklyData.map((w) => (
                <div key={w.week} className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
                  <p className="text-xl font-bold text-white">{w.count}</p>
                  <p className="text-xs text-slate-400">{w.week}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Filter */}
          <section>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {(["all", "strength", "cardio", "mobility", "other"] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    filter === f
                      ? "bg-primary border-primary text-white"
                      : "border-slate-600 text-slate-400"
                  }`}
                >
                  {f === "all" ? "Tutti" : SESSION_TYPE_LABELS[f as keyof typeof SESSION_TYPE_LABELS]}
                </button>
              ))}
            </div>
          </section>

          {/* Log list */}
          <section className="space-y-2">
            {filtered.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-8">Nessun log per questo filtro</p>
            )}
            {filtered.map((log) => (
              <Link
                key={log.id}
                href={`/history/${log.id}`}
                className="flex items-center gap-3 bg-slate-800 rounded-xl p-3 border border-slate-700"
              >
                <div className="text-2xl">{MOOD_LABELS[log.mood]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {log.plannedSession?.title || "Sessione libera"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {format(log.date.toDate(), "EEE d MMM", { locale: it })} ·{" "}
                    {log.actualDurationMin} min · RPE {log.perceivedRPE}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {log.aiAnalysis && (
                    <span className="text-xs bg-primary/20 text-primary-300 px-2 py-0.5 rounded-full block mb-1">AI</span>
                  )}
                  <svg className="w-4 h-4 text-slate-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
