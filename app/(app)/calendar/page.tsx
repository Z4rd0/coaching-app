"use client";

import { useEffect, useState } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay,
  addMonths, subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveProgram, getLogs } from "@/lib/firestore";
import type { Program, WorkoutLog, Session } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import SegmentView from "@/components/SegmentView";
import { normalizeSession } from "@/lib/segments";
import Link from "next/link";

const WEEK_DAYS = ["L", "M", "M", "G", "V", "S", "D"];

// ─── Session date calculation ─────────────────────────────────────────────────

interface ScheduledSession {
  session: Session;
  cycleNumber: number;
  weekNumber: number;
}

function getSessionsForDate(date: Date, program: Program): ScheduledSession[] {
  const result: ScheduledSession[] = [];
  const targetISO = (() => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  })();

  for (const cycle of program.cycles) {
    for (const week of cycle.weeks) {
      for (const session of week.sessions) {
        if (session.scheduledDate === targetISO) {
          result.push({ session, cycleNumber: cycle.cycleNumber, weekNumber: week.weekNumber });
        }
      }
    }
  }

  if (program.startDate) {
    const start = new Date(program.startDate + "T00:00:00");
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    let totalWeeks = 0;
    for (const cycle of program.cycles) {
      for (const week of cycle.weeks) {
        for (const session of week.sessions) {
          if (session.scheduledDate) continue;
          const sessionDate = new Date(start);
          sessionDate.setDate(start.getDate() + totalWeeks * 7 + session.dayOfWeek);
          if (isSameDay(sessionDate, target)) {
            result.push({ session, cycleNumber: cycle.cycleNumber, weekNumber: week.weekNumber });
          }
        }
        totalWeeks++;
      }
    }
    return result;
  }

  const dow = (date.getDay() + 6) % 7;
  const seen = new Set<string>();
  for (const cycle of program.cycles) {
    for (const week of cycle.weeks) {
      for (const session of week.sessions) {
        if (session.scheduledDate) continue;
        if (session.dayOfWeek === dow && !seen.has(session.title)) {
          seen.add(session.title);
          result.push({ session, cycleNumber: cycle.cycleNumber, weekNumber: week.weekNumber });
        }
      }
    }
  }
  return result;
}

// ─── Colour map ───────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  strength:  "bg-blue-500",
  cardio:    "bg-orange-400",
  mobility:  "bg-purple-400",
  circuit:   "bg-yellow-400",
  rest:      "bg-slate-500",
  other:     "bg-slate-400",
};

const TYPE_BADGE: Record<string, string> = {
  strength:  "bg-blue-500/20 text-blue-300",
  cardio:    "bg-orange-400/20 text-orange-300",
  mobility:  "bg-purple-400/20 text-purple-300",
  circuit:   "bg-yellow-400/20 text-yellow-300",
  rest:      "bg-slate-600/40 text-slate-400",
  other:     "bg-slate-600/40 text-slate-400",
};

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// ─── Session detail sheet ─────────────────────────────────────────────────────

function SessionSheet({
  item,
  date,
  onClose,
}: {
  item: ScheduledSession;
  date: Date;
  onClose: () => void;
}) {
  const { session, cycleNumber, weekNumber } = item;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pb-8 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pt-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${TYPE_BADGE[session.type] ?? "bg-slate-600/40 text-slate-400"}`}>
                  {SESSION_TYPE_LABELS[session.type]}
                </span>
                <span className="text-xs text-slate-500">
                  Ciclo {cycleNumber} · Sett. {weekNumber}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white">{session.title || SESSION_TYPE_LABELS[session.type]}</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                {session.scheduledDate
                  ? format(new Date(session.scheduledDate + "T00:00:00"), "EEE d MMMM yyyy", { locale: it })
                  : DAYS_SHORT[session.dayOfWeek]}
              </p>
            </div>
            <button onClick={onClose} className="shrink-0 text-slate-400 p-1 hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
              <p className="text-base font-bold text-primary">{session.targetRPE}</p>
              <p className="text-[10px] text-slate-400">RPE target</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
              <p className="text-base font-bold text-white">{session.durationMin}</p>
              <p className="text-[10px] text-slate-400">min</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
              <p className="text-base font-bold text-white">{session.exercises.length}</p>
              <p className="text-[10px] text-slate-400">esercizi</p>
            </div>
          </div>

          {/* Circuit info */}
          {session.type === "circuit" && (session.targetRounds || session.restBetweenRoundsSeconds) && (
            <div className="flex gap-4 bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3 text-sm">
              {session.targetRounds && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Round</p>
                  <p className="font-bold text-yellow-400">{session.targetRounds}</p>
                </div>
              )}
              {session.restBetweenRoundsSeconds && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">Recupero round</p>
                  <p className="font-bold text-yellow-400">
                    {session.restBetweenRoundsSeconds >= 60
                      ? `${session.restBetweenRoundsSeconds / 60}m`
                      : `${session.restBetweenRoundsSeconds}s`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Body: hybrid sessions render via the composable model (always through
              normalizeSession); single-paradigm keep the legacy exercise list. */}
          {normalizeSession(session).length > 1 ? (
            <SegmentView segments={normalizeSession(session)} />
          ) : session.exercises.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Esercizi</p>
              {session.exercises.map((ex, i) => (
                <div key={i} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-700/60 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{ex.name}</span>
                    {ex.restSeconds && (
                      <span className="text-[10px] text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">
                        rec.{" "}
                        {ex.restSeconds >= 60
                          ? `${Math.floor(ex.restSeconds / 60)}m${ex.restSeconds % 60 ? (ex.restSeconds % 60) + "s" : ""}`
                          : `${ex.restSeconds}s`}
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-2.5 space-y-1.5">
                    <div className="flex gap-3 text-sm">
                      <span className="text-slate-300">
                        <span className="font-semibold text-white">{ex.sets}</span>
                        <span className="text-slate-500"> ×</span>
                        <span className="font-semibold text-white ml-1">{ex.reps}</span>
                      </span>
                      {ex.load && (
                        <span className="text-slate-400">@ {ex.load}</span>
                      )}
                    </div>
                    {ex.variants && (
                      <p className="text-xs text-slate-500 italic">↔ {ex.variants}</p>
                    )}
                    {ex.notes && (
                      <p className="text-xs text-slate-400">{ex.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Session notes */}
          {session.notes && (
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Note sessione</p>
              <p className="text-sm text-slate-300">{session.notes}</p>
            </div>
          )}

          {/* CTA */}
          <Link
            href={`/log?date=${date.toISOString().slice(0, 10)}`}
            onClick={onClose}
            className="block w-full text-center bg-primary text-white font-bold py-3.5 rounded-2xl"
          >
            Registra questo allenamento →
          </Link>
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [program, setProgram] = useState<Program | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date>(new Date());
  const [sheetSession, setSheetSession] = useState<ScheduledSession | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getActiveProgram(user.uid),
      getLogs(user.uid, user.uid, 100),
    ]).then(([prog, logData]) => {
      setProgram(prog);
      setLogs(logData);
      setLoading(false);
    });
  }, [user]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (sheetSession) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sheetSession]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const logsForDate = (date: Date) =>
    logs.filter((l) => isSameDay(l.date.toDate(), date));

  const scheduledForDate = (date: Date): ScheduledSession[] =>
    program ? getSessionsForDate(date, program) : [];

  const selectedLogs = logsForDate(selected);
  const selectedScheduled = scheduledForDate(selected);

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Calendario</h1>
        <Link href="/log" className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl">
          + Log
        </Link>
      </div>

      {/* No startDate warning */}
      {program && !program.startDate && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-300">
          Il programma non ha una data di inizio — le sessioni vengono mostrate per giorno della settimana.{" "}
          <Link href={`/programs/${program.id}/edit`} className="underline font-medium">Aggiungi la data</Link>
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-base font-semibold text-white capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: it })}
        </p>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 text-slate-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map((d, i) => (
          <div key={i} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelectedDay = isSameDay(day, selected);
          const isTodayDay = isToday(day);
          const dayLogs = logsForDate(day);
          const dayScheduled = scheduledForDate(day);
          const hasDot = dayLogs.length > 0 || dayScheduled.length > 0;

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelected(day)}
              className={`relative flex flex-col items-center py-1.5 rounded-xl transition-colors ${
                isSelectedDay
                  ? "bg-primary"
                  : isTodayDay
                  ? "bg-primary/20"
                  : "hover:bg-slate-800"
              }`}
            >
              <span className={`text-sm font-medium ${
                !isCurrentMonth ? "text-slate-600" :
                isSelectedDay ? "text-white" :
                isTodayDay ? "text-primary" :
                "text-slate-200"
              }`}>
                {format(day, "d")}
              </span>
              {hasDot && isCurrentMonth && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayLogs.length > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelectedDay ? "bg-white" : "bg-primary"}`} />
                  )}
                  {dayScheduled.length > 0 && dayLogs.length === 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelectedDay ? "bg-white/60" : "bg-slate-500"}`} />
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Log registrato</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Sessione programmata</span>
      </div>

      {/* Selected day detail */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-300 capitalize">
          {format(selected, "EEEE d MMMM", { locale: it })}
        </p>

        {/* Logged workouts */}
        {selectedLogs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Allenamenti registrati</p>
            {selectedLogs.map((log) => (
              <Link
                key={log.id}
                href={`/history/${log.id}`}
                className="flex items-center gap-3 bg-slate-800 rounded-xl p-3 border border-slate-700"
              >
                <div className="w-2 h-8 bg-primary rounded-full" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{log.plannedSession?.title || "Sessione libera"}</p>
                  <p className="text-xs text-slate-400">{log.actualDurationMin} min · RPE {log.perceivedRPE}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Planned sessions */}
        {selectedScheduled.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Sessione programmata</p>
            {selectedScheduled.map((item, i) => {
              const { session, cycleNumber, weekNumber } = item;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSheetSession(item)}
                  className="w-full flex items-center gap-3 bg-slate-800 rounded-xl p-3 border border-slate-700 hover:border-slate-600 transition-colors text-left"
                >
                  <div className={`w-2 h-8 rounded-full shrink-0 ${TYPE_COLOR[session.type] || "bg-slate-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{session.title || SESSION_TYPE_LABELS[session.type]}</p>
                    <p className="text-xs text-slate-400">
                      {SESSION_TYPE_LABELS[session.type]} · {session.durationMin} min · RPE {session.targetRPE}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ciclo {cycleNumber} · Settimana {weekNumber}
                    </p>
                    {session.exercises.length > 0 && (
                      <p className="text-xs text-slate-500 truncate">
                        {session.exercises.slice(0, 3).map(e => e.name).join(", ")}
                        {session.exercises.length > 3 && ` +${session.exercises.length - 3}`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-[10px] text-primary font-medium">Apri</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedLogs.length === 0 && selectedScheduled.length === 0 && (
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-slate-400 text-sm">Nessuna attività per questo giorno</p>
            <Link href="/log" className="text-primary text-xs font-medium mt-1 block">
              + Aggiungi log
            </Link>
          </div>
        )}
      </div>

      {/* Session detail sheet */}
      {sheetSession && (
        <SessionSheet item={sheetSession} date={selected} onClose={() => setSheetSession(null)} />
      )}
    </div>
  );
}
