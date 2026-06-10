"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getLogs } from "@/lib/firestore";
import type { WorkoutLog } from "@/types";
import { MOOD_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

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

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-white mb-4">Storico allenamenti</h1>

      {logs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">Nessun allenamento loggato ancora.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
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
                    <span className="text-xl">{MOOD_LABELS[log.mood]}</span>
                  </div>
                </div>

                <div className="flex gap-4 text-xs text-slate-400 mt-2">
                  <span>RPE {log.perceivedRPE}/10</span>
                  <span>{log.actualDurationMin} min</span>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
