"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { format, addDays, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getProgram, setActiveProgram, deleteProgram } from "@/lib/firestore";
import type { Program, Session } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const TYPE_COLOR: Record<Session["type"], string> = {
  strength: "bg-primary/20 text-primary-300",
  cardio:   "bg-blue-500/20 text-blue-300",
  mobility: "bg-purple-500/20 text-purple-300",
  rest:     "bg-slate-600/40 text-slate-400",
  other:    "bg-slate-600/40 text-slate-300",
  circuit:  "bg-yellow-400/20 text-yellow-300",
};

// ─── Date helper ─────────────────────────────────────────────────────────────
// Returns formatted date string if program.startDate is set, else null.
// cycleIdx and weekIdx are 0-based here.
function computeSessionDate(
  startDate: string | undefined,
  cycleWeekOffset: number,  // total weeks before this week
  session: Session
): string | null {
  // If session has an explicit pinned date, use it
  if (session.scheduledDate) {
    try {
      return format(parseISO(session.scheduledDate), "EEE d MMM", { locale: it });
    } catch {
      return null;
    }
  }
  if (!startDate) return null;
  try {
    const monday = parseISO(startDate);
    const weekStart = addDays(monday, cycleWeekOffset * 7);
    const sessionDate = addDays(weekStart, session.dayOfWeek);
    return format(sessionDate, "EEE d MMM", { locale: it });
  } catch {
    return null;
  }
}

// Chevron icon component
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function ProgramDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Collapse state — all open by default
  const [closedCycles, setClosedCycles] = useState<Set<number>>(new Set());
  const [closedWeeks, setClosedWeeks]   = useState<Set<string>>(new Set());
  const [openSessions, setOpenSessions] = useState<Set<string>>(new Set());

  const toggleCycle = (cycleNum: number) =>
    setClosedCycles((prev) => {
      const next = new Set(prev);
      if (next.has(cycleNum)) { next.delete(cycleNum); } else { next.add(cycleNum); }
      return next;
    });

  const toggleWeek = (key: string) =>
    setClosedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });

  const toggleSession = (key: string) =>
    setOpenSessions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });

  const handleDelete = async () => {
    if (!user || !program) return;
    if (!confirm(`Eliminare "${program.name}"? L'operazione non è reversibile.`)) return;
    setDeleting(true);
    await deleteProgram(user.uid, program.id);
    router.replace("/programs");
  };

  useEffect(() => {
    if (!user) return;
    getProgram(user.uid, id).then((p) => {
      setProgram(p);
      setLoading(false);
    });
  }, [user, id]);

  const handleActivate = async () => {
    if (!user || !program) return;
    setActivating(true);
    await setActiveProgram(user.uid, program.id);
    setProgram((prev) => prev ? { ...prev, isActive: true } : prev);
    setActivating(false);
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!program) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-slate-400">Programma non trovato</p>
    </div>
  );

  // Pre-compute cumulative week offsets per cycle (for date calculation)
  const cycleWeekOffsets: number[] = [];
  let cumulative = 0;
  for (const cycle of program.cycles) {
    cycleWeekOffsets.push(cumulative);
    cumulative += cycle.weeks.length;
  }

  return (
    <div className="px-4 pt-6 pb-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {program.isActive && (
              <span className="text-xs bg-primary/20 text-primary-300 px-2 py-0.5 rounded-full font-medium">Attivo</span>
            )}
            <span className="text-xs text-slate-400">{program.sport}</span>
          </div>
          <h1 className="text-xl font-bold text-white truncate">{program.name}</h1>
          {program.startDate && (
            <p className="text-xs text-slate-500 mt-0.5">
              Inizio: {format(parseISO(program.startDate), "d MMMM yyyy", { locale: it })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link href={`/programs/${id}/edit`} className="text-sm text-primary font-medium">
            Modifica
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-400 font-medium disabled:opacity-50"
          >
            {deleting ? "…" : "Elimina"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatMini label="Cicli" value={String(program.cycles.length)} />
        <StatMini
          label="Settimane"
          value={String(program.cycles.reduce((s, c) => s + c.weeks.length, 0))}
        />
        <StatMini
          label="Sessioni"
          value={String(
            program.cycles.reduce(
              (s, c) => s + c.weeks.reduce((ws, w) => ws + w.sessions.length, 0),
              0
            )
          )}
        />
      </div>

      {!program.isActive && (
        <button
          onClick={handleActivate}
          disabled={activating}
          className="w-full bg-primary text-white font-semibold py-3 rounded-xl disabled:opacity-60"
        >
          {activating ? "Attivazione…" : "Attiva questo programma"}
        </button>
      )}

      {/* ── Collapsible cycles ── */}
      <div className="space-y-4">
        {program.cycles.map((cycle, cycleIdx) => {
          const cycleOpen = !closedCycles.has(cycle.cycleNumber);
          const cycleOffset = cycleWeekOffsets[cycleIdx];
          const totalSessions = cycle.weeks.reduce((s, w) => s + w.sessions.length, 0);

          return (
            <section key={cycle.cycleNumber} className="rounded-2xl border border-slate-700 overflow-hidden">
              {/* Cycle header */}
              <button
                type="button"
                onClick={() => toggleCycle(cycle.cycleNumber)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Ciclo {cycle.cycleNumber}</span>
                  <span className="text-xs text-slate-500">
                    {cycle.weeks.length} sett · {totalSessions} sessioni
                  </span>
                </div>
                <span className="text-slate-400">
                  <Chevron open={cycleOpen} />
                </span>
              </button>

              {/* Cycle body */}
              {cycleOpen && (
                <div className="divide-y divide-slate-700/50">
                  {cycle.weeks.map((week, weekIdx) => {
                    const weekKey = `${cycle.cycleNumber}-${week.weekNumber}`;
                    const weekOpen = !closedWeeks.has(weekKey);
                    const weekOffset = cycleOffset + weekIdx;

                    return (
                      <div key={week.weekNumber}>
                        {/* Week header */}
                        <button
                          type="button"
                          onClick={() => toggleWeek(weekKey)}
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700/30 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-300">
                              Settimana {week.weekNumber}
                            </span>
                            {program.startDate && (
                              <span className="text-[10px] text-slate-500">
                                {(() => {
                                  try {
                                    const mon = addDays(parseISO(program.startDate), weekOffset * 7);
                                    const sun = addDays(mon, 6);
                                    return `${format(mon, "d MMM", { locale: it })} – ${format(sun, "d MMM", { locale: it })}`;
                                  } catch { return ""; }
                                })()}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-600">
                              {week.sessions.length} sessioni
                            </span>
                          </div>
                          <span className="text-slate-500">
                            <Chevron open={weekOpen} />
                          </span>
                        </button>

                        {/* Sessions list */}
                        {weekOpen && (
                          <div className="divide-y divide-slate-700/30">
                            {week.sessions.length === 0 ? (
                              <p className="text-slate-500 text-sm text-center py-4 px-4">
                                Nessuna sessione
                              </p>
                            ) : (
                              week.sessions.map((session, si) => {
                                const sessionKey = `${weekKey}-${si}`;
                                const sessionOpen = openSessions.has(sessionKey);
                                const dateLabel = computeSessionDate(
                                  program.startDate,
                                  weekOffset,
                                  session
                                );

                                return (
                                  <div key={si}>
                                    {/* Session header row — always visible */}
                                    <button
                                      type="button"
                                      onClick={() => toggleSession(sessionKey)}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors text-left"
                                    >
                                      {/* Day / date */}
                                      <div className="w-12 shrink-0 text-center">
                                        {dateLabel ? (
                                          <p className="text-[10px] font-medium text-slate-400 capitalize leading-tight">
                                            {dateLabel}
                                          </p>
                                        ) : (
                                          <p className="text-xs font-semibold text-slate-500">
                                            {DAYS_SHORT[session.dayOfWeek]}
                                          </p>
                                        )}
                                      </div>

                                      {/* Type badge + title */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TYPE_COLOR[session.type]}`}>
                                            {SESSION_TYPE_LABELS[session.type]}
                                          </span>
                                          <span className="text-[10px] text-slate-500">
                                            {session.durationMin} min · RPE {session.targetRPE}
                                          </span>
                                        </div>
                                        <p className="text-sm font-medium text-white truncate">
                                          {session.title || "—"}
                                        </p>
                                        {!sessionOpen && session.exercises.length > 0 && (
                                          <p className="text-[10px] text-slate-500 mt-0.5">
                                            {session.exercises.length} esercizi
                                            {session.type === "circuit" && session.targetRounds
                                              ? ` · ${session.targetRounds} round`
                                              : ""}
                                          </p>
                                        )}
                                      </div>

                                      {/* RPE pill + chevron */}
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-slate-500">
                                          <Chevron open={sessionOpen} />
                                        </span>
                                      </div>
                                    </button>

                                    {/* Session detail — expanded */}
                                    {sessionOpen && (
                                      <div className="px-4 pb-4 space-y-3 bg-slate-800/30">
                                        {/* Circuit info */}
                                        {session.type === "circuit" && (
                                          <div className="flex gap-4 text-xs text-slate-400 border-t border-slate-700/40 pt-3">
                                            {session.targetRounds && (
                                              <span>🔄 {session.targetRounds} round target</span>
                                            )}
                                            {session.restBetweenRoundsSeconds && (
                                              <span>⏸ {session.restBetweenRoundsSeconds >= 60
                                                ? `${Math.floor(session.restBetweenRoundsSeconds / 60)}m${session.restBetweenRoundsSeconds % 60 ? (session.restBetweenRoundsSeconds % 60) + "s" : ""}`
                                                : `${session.restBetweenRoundsSeconds}s`} recupero</span>
                                            )}
                                          </div>
                                        )}

                                        {/* Exercises */}
                                        {session.exercises.length > 0 && (
                                          <ul className="space-y-2 border-t border-slate-700/40 pt-3">
                                            {session.exercises.map((ex, ei) => (
                                              <li key={ei} className="text-xs">
                                                <div className="flex gap-2 items-baseline">
                                                  <span className="text-slate-600 shrink-0 w-4 text-right">{ei + 1}.</span>
                                                  <span className="font-medium text-slate-200">{ex.name}</span>
                                                  <span className="text-slate-500">{ex.sets}×{ex.reps}</span>
                                                  {ex.load && <span className="text-slate-500">@ {ex.load}</span>}
                                                  {ex.restSeconds && (
                                                    <span className="text-slate-600 ml-auto">
                                                      {ex.restSeconds >= 60
                                                        ? `${Math.floor(ex.restSeconds / 60)}m${ex.restSeconds % 60 ? (ex.restSeconds % 60) + "s" : ""}`
                                                        : `${ex.restSeconds}s`} rec
                                                    </span>
                                                  )}
                                                </div>
                                                {ex.variants && (
                                                  <p className="text-slate-500 mt-0.5 ml-6">↔ {ex.variants}</p>
                                                )}
                                                {ex.notes && (
                                                  <p className="text-slate-500 mt-0.5 ml-6 italic">{ex.notes}</p>
                                                )}
                                              </li>
                                            ))}
                                          </ul>
                                        )}

                                        {/* Session notes */}
                                        {session.notes && (
                                          <p className="text-xs text-slate-500 italic border-t border-slate-700/40 pt-2">
                                            {session.notes}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
