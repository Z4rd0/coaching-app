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
import Link from "next/link";

const WEEK_DAYS = ["L", "M", "M", "G", "V", "S", "D"];

// ─── Session date calculation ────────────────────────────────────────────────

interface ScheduledSession {
  session: Session;
  cycleNumber: number;
  weekNumber: number;
}

/**
 * Returns sessions scheduled on `date` based on the program's startDate.
 * If the program has no startDate, falls back to day-of-week matching
 * (shows the same session on every matching weekday).
 */
function getSessionsForDate(date: Date, program: Program): ScheduledSession[] {
  const result: ScheduledSession[] = [];

  if (program.startDate) {
    const start = new Date(program.startDate + "T00:00:00");
    // Normalise both dates to midnight so diff is exact days
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    let totalWeeks = 0;
    for (const cycle of program.cycles) {
      for (const week of cycle.weeks) {
        for (const session of week.sessions) {
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

  // Fallback — no startDate: show sessions that match this weekday
  const dow = (date.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const seen = new Set<string>();
  for (const cycle of program.cycles) {
    for (const week of cycle.weeks) {
      for (const session of week.sessions) {
        if (session.dayOfWeek === dow && !seen.has(session.title)) {
          seen.add(session.title);
          result.push({ session, cycleNumber: cycle.cycleNumber, weekNumber: week.weekNumber });
        }
      }
    }
  }
  return result;
}

// ─── Colour map ──────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  strength: "bg-blue-500",
  cardio: "bg-orange-400",
  mobility: "bg-purple-400",
  rest: "bg-slate-500",
  other: "bg-slate-400",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [program, setProgram] = useState<Program | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date>(new Date());

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
          Il programma non ha una data di inizio — le sessioni vengono mostrate in base al giorno della settimana.{" "}
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

              {/* Dots */}
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
                {log.aiAnalysis && (
                  <span className="text-xs bg-primary/20 text-primary-300 px-2 py-0.5 rounded-full">AI ✨</span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Planned sessions */}
        {selectedScheduled.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Sessione programmata</p>
            {selectedScheduled.map(({ session, cycleNumber, weekNumber }, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-xl p-3 border border-slate-700">
                <div className={`w-2 h-8 rounded-full ${TYPE_COLOR[session.type] || "bg-slate-500"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{session.title || SESSION_TYPE_LABELS[session.type]}</p>
                  <p className="text-xs text-slate-400">
                    {SESSION_TYPE_LABELS[session.type]} · {session.durationMin} min · RPE target {session.targetRPE}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ciclo {cycleNumber} · Settimana {weekNumber}
                  </p>
                  {session.exercises.length > 0 && (
                    <p className="text-xs text-slate-500">
                      {session.exercises.slice(0, 3).map(e => e.name).join(", ")}
                      {session.exercises.length > 3 && ` +${session.exercises.length - 3}`}
                    </p>
                  )}
                </div>
                <Link
                  href="/log"
                  className="text-xs bg-primary/20 text-primary-300 px-2 py-1 rounded-lg font-medium shrink-0"
                >
                  Log
                </Link>
              </div>
            ))}
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
    </div>
  );
}
