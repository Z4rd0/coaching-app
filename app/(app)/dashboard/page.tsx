"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveProgram, getLogs, getTodaySession } from "@/lib/firestore";
import type { Program, WorkoutLog } from "@/types";
import { SESSION_TYPE_LABELS, MOOD_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

export default function DashboardPage() {
  const { user, coach, signOut } = useAuth();
  const router = useRouter();
  const [program, setProgram] = useState<Program | null>(null);
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionExpanded, setSessionExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const athleteId = user.uid;
    Promise.all([
      getActiveProgram(user.uid),
      getLogs(user.uid, athleteId, 5),
    ]).then(([prog, logs]) => {
      setProgram(prog);
      setRecentLogs(logs);
    }).finally(() => setLoading(false));
  }, [user]);

  const todaySession = program ? getTodaySession(program) : null;

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekLogs = recentLogs.filter((l) => l.date.toMillis() > oneWeekAgo);
  const avgRPE =
    weekLogs.length > 0
      ? (weekLogs.reduce((s, l) => s + l.perceivedRPE, 0) / weekLogs.length).toFixed(1)
      : "—";

  const handleSignOut = async () => {
    document.cookie = "coach-auth=; path=/; max-age=0";
    await signOut();
    router.replace("/auth");
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-4 pt-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400 text-sm capitalize">
            {format(new Date(), "EEEE d MMMM", { locale: it })}
          </p>
          <h1 className="text-xl font-bold text-white">
            Ciao, {coach?.name || "Coach"} 👋
          </h1>
        </div>
        <button
          onClick={handleSignOut}
          className="text-slate-400 hover:text-white transition-colors p-2"
          aria-label="Esci"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
          </svg>
        </button>
      </div>

      {/* Today's session */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Sessione di oggi
        </h2>
        {todaySession ? (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            {/* Tappable header */}
            <div
              className="p-4 cursor-pointer active:bg-slate-700/50 transition-colors"
              onClick={() => setSessionExpanded((v) => !v)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium bg-primary/20 text-primary-300 px-2 py-0.5 rounded-full">
                    {SESSION_TYPE_LABELS[todaySession.type]}
                  </span>
                  <h3 className="text-lg font-semibold text-white mt-1">{todaySession.title}</h3>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">RPE</p>
                    <p className="text-xl font-bold text-primary">{todaySession.targetRPE}</p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-500 transition-transform ${sessionExpanded ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              <div className="flex gap-4 text-sm text-slate-400 mt-2">
                <span>⏱ {todaySession.durationMin} min</span>
                <span>💪 {todaySession.exercises.length} esercizi</span>
              </div>
            </div>

            {/* Expandable exercise list */}
            {sessionExpanded && todaySession.exercises.length > 0 && (
              <div className="border-t border-slate-700 px-4 py-3">
                <ul className="space-y-2">
                  {todaySession.exercises.map((ex, i) => (
                    <li key={i} className="text-sm text-slate-300">
                      <div className="flex gap-2 items-baseline">
                        <span className="text-slate-500 shrink-0">{i + 1}.</span>
                        <span className="font-medium">{ex.name}</span>
                        <span className="text-slate-500">{ex.sets}×{ex.reps}</span>
                        {ex.load && <span className="text-slate-500">@ {ex.load}</span>}
                        {ex.restSeconds && (
                          <span className="text-slate-600 text-xs ml-auto shrink-0">
                            {ex.restSeconds >= 60
                              ? `${Math.floor(ex.restSeconds / 60)}m${ex.restSeconds % 60 ? (ex.restSeconds % 60) + "s" : ""}`
                              : `${ex.restSeconds}s`} rec
                          </span>
                        )}
                      </div>
                      {ex.notes && <p className="text-xs text-slate-500 ml-4 mt-0.5 italic">{ex.notes}</p>}
                    </li>
                  ))}
                </ul>
                {todaySession.notes && (
                  <p className="text-xs text-slate-500 mt-3 pt-2 border-t border-slate-700 italic">{todaySession.notes}</p>
                )}
              </div>
            )}

            {/* CTA */}
            <div className="px-4 pb-4">
              <Link
                href="/log"
                className="block w-full text-center bg-primary hover:bg-primary-600 text-white font-semibold py-2.5 rounded-xl transition-colors"
              >
                Registra allenamento
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 text-center">
            {program ? (
              <>
                <p className="text-slate-400 mb-3">Nessuna sessione programmata oggi 🎉</p>
                <Link href="/log" className="text-primary text-sm font-medium">
                  Log sessione libera →
                </Link>
              </>
            ) : (
              <>
                <p className="text-slate-400 mb-3">Nessun programma attivo</p>
                <Link href="/programs" className="text-primary text-sm font-medium">
                  Crea un programma →
                </Link>
              </>
            )}
          </div>
        )}
      </section>

      {/* Weekly stats */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Questa settimana
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Allenamenti" value={String(weekLogs.length)} />
          <StatCard label="RPE medio" value={String(avgRPE)} />
          <div className="bg-slate-800 rounded-2xl p-3 border border-slate-700 flex flex-col items-center justify-center gap-1">
            <span className="text-lg">⌚</span>
            <span className="text-xs text-slate-400 text-center">Garmin sync</span>
            <span className="text-[10px] text-slate-600">coming soon</span>
          </div>
        </div>
      </section>

      {/* Recent logs */}
      {recentLogs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Ultimi log
            </h2>
            <Link href="/history" className="text-primary text-xs font-medium">
              Vedi tutti
            </Link>
          </div>
          <div className="space-y-2">
            {recentLogs.slice(0, 3).map((log) => (
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
                    {format(log.date.toDate(), "d MMM", { locale: it })} · {log.actualDurationMin} min · RPE {log.perceivedRPE}
                  </p>
                </div>
                {log.aiAnalysis && (
                  <span className="text-xs bg-primary/20 text-primary-300 px-2 py-0.5 rounded-full shrink-0">AI</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="h-2" />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-2xl p-3 border border-slate-700 flex flex-col items-center justify-center gap-1">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-slate-400 text-center">{label}</span>
    </div>
  );
}
