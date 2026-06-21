"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getAthletePrograms, getGroupsForAthlete, getGroupPrograms } from "@/lib/firestore";
import type { AthleteProgram } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import CardioIntervals from "@/components/CardioIntervals";

/** Personal program, or a shared group program tagged with its group name and id */
type DisplayProgram = AthleteProgram & { groupName?: string; groupId?: string };

const TYPE_COLOR: Record<string, string> = {
  strength: "bg-blue-500",
  cardio: "bg-orange-400",
  mobility: "bg-purple-400",
  rest: "bg-slate-500",
  other: "bg-slate-400",
};

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export default function AthleteProgramPage() {
  const { user, athleteAccess } = useAuth();
  const [programs, setPrograms] = useState<DisplayProgram[]>([]);
  const [selected, setSelected] = useState<DisplayProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !athleteAccess) return;
    const { coachId, athleteId } = athleteAccess;
    Promise.all([
      getAthletePrograms(coachId, athleteId),
      getGroupsForAthlete(coachId, user.uid).then((groups) =>
        Promise.all(
          groups.map(async (g) =>
            (await getGroupPrograms(coachId, g.id)).map(
              (p): DisplayProgram => ({ ...p, groupName: g.name, groupId: g.id })
            )
          )
        ).then((nested) => nested.flat())
      ),
    ]).then(([personal, fromGroups]) => {
      const all: DisplayProgram[] = [...personal, ...fromGroups];
      setPrograms(all);
      const active = all.find((p) => p.isActive) ?? all[0] ?? null;
      setSelected(active);
    }).finally(() => setLoading(false));
  }, [user, athleteAccess]);

  const toggleKey = (k: string) =>
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-white mb-4">Il mio programma</h1>

      {programs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">Nessun programma assegnato ancora.</p>
          <p className="text-slate-500 text-xs mt-1">Il tuo coach ti assegnerà presto un programma.</p>
        </div>
      ) : (
        <>
          {/* Program selector */}
          {programs.length > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {programs.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    selected?.id === p.id
                      ? "bg-primary border-primary text-white"
                      : "border-slate-600 text-slate-400"
                  }`}
                >
                  {p.groupName ? `👥 ${p.name}` : p.name}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="space-y-4">
              {/* Program header */}
              <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-white font-bold">{selected.name}</h2>
                    {selected.sport && (
                      <p className="text-slate-400 text-xs">{selected.sport}</p>
                    )}
                    {selected.groupName && (
                      <p className="text-primary text-xs mt-0.5">
                        👥 Gruppo {selected.groupName} — programma condiviso
                      </p>
                    )}
                  </div>
                  {selected.isActive && (
                    <span className="bg-primary/20 text-primary text-xs font-medium px-2 py-0.5 rounded-full shrink-0">
                      Attivo
                    </span>
                  )}
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-400">
                  <span>{selected.cycles.length} cicli</span>
                  <span>
                    {selected.cycles.reduce((a, c) => a + c.weeks.length, 0)} settimane
                  </span>
                  {selected.startDate && (
                    <span>Inizio: {selected.startDate}</span>
                  )}
                </div>
              </div>

              {/* Cycles & weeks */}
              {selected.cycles.map((cycle, ci) => (
                <div key={ci} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-slate-700" />
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                      Ciclo {cycle.cycleNumber}
                    </span>
                    <div className="h-px flex-1 bg-slate-700" />
                  </div>

                  {cycle.weeks.map((week, wi) => (
                    <div key={wi} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-slate-700">
                        <span className="text-sm font-semibold text-white">
                          Settimana {week.weekNumber}
                        </span>
                        <span className="text-slate-500 text-xs ml-2">
                          {week.sessions.length} sessioni
                        </span>
                      </div>

                      {week.sessions.length === 0 ? (
                        <p className="text-slate-500 text-xs text-center py-4">Settimana di recupero</p>
                      ) : (
                        <div className="divide-y divide-slate-700/50">
                          {week.sessions.map((session, si) => {
                            const k = `${ci}-${wi}-${si}`;
                            const isOpen = expandedKeys.has(k);
                            const logUrl = selected
                              ? `/athlete/log?programId=${selected.id}&ci=${ci}&wi=${wi}&si=${si}${selected.groupId ? `&groupId=${selected.groupId}` : ""}`
                              : "/athlete/log";
                            return (
                              <div key={si}>
                                <div className="flex items-center">
                                  <button
                                    type="button"
                                    className="flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
                                    onClick={() => toggleKey(k)}
                                  >
                                    <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_COLOR[session.type] ?? "bg-slate-500"}`} />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {session.scheduledDate ? (
                                          <span className="text-xs font-medium text-primary">📅 {session.scheduledDate}</span>
                                        ) : (
                                          <span className="text-xs text-slate-400">{DAYS[session.dayOfWeek]}</span>
                                        )}
                                        <span className="text-xs text-slate-600">·</span>
                                        <span className="text-xs text-slate-400">{SESSION_TYPE_LABELS[session.type]}</span>
                                        {session.title && (
                                          <>
                                            <span className="text-xs text-slate-600">·</span>
                                            <span className="text-xs font-semibold text-white">{session.title}</span>
                                          </>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        {session.intervals?.length
                                          ? `${session.intervals.length} blocchi · `
                                          : session.exercises.length
                                          ? `${session.exercises.length} esercizi · `
                                          : ""}
                                        {session.durationMin} min · RPE {session.targetRPE}
                                      </p>
                                    </div>
                                    <svg
                                      className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                  </button>
                                  <Link
                                    href={logUrl}
                                    className="shrink-0 mx-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                                  >
                                    Logga →
                                  </Link>
                                </div>

                                {isOpen && (
                                  <div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-700/50 bg-slate-900/30">
                                    {session.intervals && session.intervals.length > 0 && (
                                      <CardioIntervals intervals={session.intervals} />
                                    )}
                                    {session.exercises.map((ex, ei) => (
                                      <div key={ei} className="bg-slate-800 rounded-xl px-3 py-2.5">
                                        <p className="text-white text-sm font-medium">{ex.name || `Esercizio ${ei + 1}`}</p>
                                        <div className="flex gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                                          <span>{ex.sets} serie × {ex.reps}</span>
                                          {ex.load && <span>{ex.load}</span>}
                                          {ex.restSeconds && <span>Recupero: {ex.restSeconds}s</span>}
                                        </div>
                                        {ex.variants && (
                                          <p className="text-xs text-slate-500 mt-1 italic">{ex.variants}</p>
                                        )}
                                        {ex.notes && (
                                          <p className="text-xs text-slate-500 mt-1">{ex.notes}</p>
                                        )}
                                      </div>
                                    ))}
                                    {session.notes && (
                                      <p className="text-xs text-slate-400 italic px-1">{session.notes}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
