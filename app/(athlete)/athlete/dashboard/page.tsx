"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import {
  getActiveAthleteProgram,
  getLogs,
  getTodaySession,
  getGroupsForAthlete,
  getActiveGroupProgram,
} from "@/lib/firestore";
import type { AthleteProgram, GroupProgram, WorkoutLog } from "@/types";
import { SESSION_TYPE_LABELS, MOOD_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function AthleteDashboardPage() {
  const { user, athleteAccess, signOut } = useAuth();
  const router = useRouter();
  const [program, setProgram] = useState<AthleteProgram | null>(null);
  const [groupPrograms, setGroupPrograms] = useState<(GroupProgram & { groupName: string })[]>([]);
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !athleteAccess) return;
    const { coachId, athleteId } = athleteAccess;
    Promise.all([
      getActiveAthleteProgram(coachId, athleteId),
      getLogs(coachId, athleteId, 5),
      getGroupsForAthlete(coachId, user.uid).then((groups) =>
        Promise.all(
          groups.map(async (g) => {
            const p = await getActiveGroupProgram(coachId, g.id);
            return p ? { ...p, groupName: g.name } : null;
          })
        ).then((res) => res.filter((p): p is GroupProgram & { groupName: string } => p !== null))
      ),
    ]).then(([prog, logs, gProgs]) => {
      setProgram(prog);
      setRecentLogs(logs);
      setGroupPrograms(gProgs);
    }).finally(() => setLoading(false));
  }, [user, athleteAccess]);

  const todaySession = program ? getTodaySession(program) : null;
  const todayGroupSessions = groupPrograms
    .map((p) => ({ groupName: p.groupName, programName: p.name, session: getTodaySession(p) }))
    .filter((g) => g.session !== null);

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekLogs = recentLogs.filter((l) => l.date.toMillis() > oneWeekAgo);
  const avgRPE = weekLogs.length > 0
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
            Ciao 👋
          </h1>
        </div>
        <button onClick={handleSignOut} className="text-slate-500 text-xs">
          Esci
        </button>
      </div>

      {/* Today's session */}
      {program && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Oggi</p>
            <span className="text-xs text-slate-500">{program.name}</span>
          </div>

          {todaySession ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                  {SESSION_TYPE_LABELS[todaySession.type]}
                </span>
                {todaySession.title && (
                  <span className="text-white font-semibold text-sm">{todaySession.title}</span>
                )}
              </div>
              <p className="text-slate-400 text-xs">
                {todaySession.exercises.length} esercizi · {todaySession.durationMin} min · RPE {todaySession.targetRPE}
              </p>
              <Link
                href="/athlete/log"
                className="mt-3 block w-full text-center bg-primary text-white font-semibold py-2.5 rounded-xl text-sm"
              >
                Logga allenamento
              </Link>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-slate-400 text-sm">Nessuna sessione pianificata per oggi 🛌</p>
              <Link href="/athlete/log" className="text-primary text-xs mt-1 inline-block">
                Logga comunque →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Today's group sessions */}
      {todayGroupSessions.map((g) => (
        <div key={`${g.groupName}-${g.programName}`} className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Oggi · 👥 {g.groupName}
            </p>
            <span className="text-xs text-slate-500">{g.programName}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                {SESSION_TYPE_LABELS[g.session!.type]}
              </span>
              {g.session!.title && (
                <span className="text-white font-semibold text-sm">{g.session!.title}</span>
              )}
            </div>
            <p className="text-slate-400 text-xs">
              {g.session!.exercises.length} esercizi · {g.session!.durationMin} min · RPE {g.session!.targetRPE}
            </p>
            <Link
              href="/athlete/log"
              className="mt-3 block w-full text-center bg-primary text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              Logga allenamento
            </Link>
          </div>
        </div>
      ))}

      {!program && groupPrograms.length === 0 && (
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 text-center">
          <p className="text-slate-400 text-sm">Nessun programma attivo.</p>
          <p className="text-slate-500 text-xs mt-1">Il tuo coach ti assegnerà presto un programma.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Sessioni questa settimana</p>
          <p className="text-2xl font-bold text-white">{weekLogs.length}</p>
        </div>
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 mb-1">RPE medio</p>
          <p className="text-2xl font-bold text-white">{avgRPE}</p>
        </div>
      </div>

      {/* Recent logs */}
      {recentLogs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Ultimi allenamenti</h2>
            <Link href="/athlete/history" className="text-primary text-xs">Tutti →</Link>
          </div>
          <div className="space-y-2">
            {recentLogs.slice(0, 3).map((log) => (
              <div key={log.id} className="bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-medium">
                    {format(log.date.toDate(), "EEE d MMM", { locale: it })}
                  </p>
                  <div className="flex gap-2 text-xs text-slate-400">
                    <span>{MOOD_LABELS[log.mood]}</span>
                    <span>RPE {log.perceivedRPE}</span>
                    <span>{log.actualDurationMin} min</span>
                  </div>
                </div>
                {log.notes && (
                  <p className="text-slate-500 text-xs mt-1 truncate">{log.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
