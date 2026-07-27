"use client";

import { useEffect, useState } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth, isToday, isSameDay,
  addMonths, subMonths,
} from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveProgram, getLogs, getScheduledSessionsForDate } from "@/lib/firestore";
import type { ScheduledSession } from "@/lib/firestore";
import { toLocalISODate } from "@/lib/dates";
import { sessionLoad } from "@/lib/load";
import type { Program, WorkoutLog } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import SegmentView from "@/components/SegmentView";
import { normalizeSession } from "@/lib/segments";
import { sessionMeta } from "@/lib/sessionMeta";
import SessionProfile from "@/components/SessionProfile";
import Link from "next/link";

const WEEK_DAYS = ["L", "M", "M", "G", "V", "S", "D"];

/** What a calendar day is telling the coach at a glance.
 *
 *  Two identical grey dots ("something is logged" / "something is planned")
 *  can't distinguish the one case that matters — a planned session that was
 *  skipped — so the month read as uniformly busy whatever actually happened. */
type DayStatus = "done" | "extra" | "missed" | "planned" | "empty";

const DAY_STATUS_COLOR: Record<Exclude<DayStatus, "empty">, string> = {
  done: "#22C55E",     // planned and logged
  extra: "#60A5FA",    // logged, nothing was planned
  missed: "#EF4444",   // planned, not logged, day is over
  planned: "#94A3B8",  // still to come
};

function dayStatus(planned: number, logged: number, day: Date, today: Date): DayStatus {
  if (logged > 0) return planned > 0 ? "done" : "extra";
  if (planned === 0) return "empty";
  return day < today ? "missed" : "planned";
}

// Session placement lives in lib/firestore (getScheduledSessionsForDate) so the
// calendar, the dashboard and the log pages can never disagree on which day a
// session belongs to.

// ─── Colour map ───────────────────────────────────────────────────────────────

const DAYS_SHORT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const MOOD_EMOJI: Record<number, string> = { 1: "😫", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

const RPE_COLOR = (rpe: number) =>
  rpe <= 3 ? "#22C55E" : rpe <= 5 ? "#84CC16" : rpe <= 7 ? "#EAB308" : rpe <= 8 ? "#F97316" : "#EF4444";

// ─── Session detail sheet ─────────────────────────────────────────────────────

function SessionSheet({
  item,
  index,
  date,
  onClose,
}: {
  item: ScheduledSession;
  /** Position of this session among the day's sessions — handed to /log so it
   *  pre-selects the one actually shown here, not just the day's first. */
  index: number;
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
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${sessionMeta(session.type).badge}`}>
                  {sessionMeta(session.type).icon} {SESSION_TYPE_LABELS[session.type]}
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

          {/* Shape of the session at a glance */}
          <SessionProfile session={session} height={32} />

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
                    {ex.videoUrl && (
                      <a
                        href={ex.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary"
                      >
                        ▶ Guarda il video
                      </a>
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
            href={`/log?date=${toLocalISODate(date)}&idx=${index}`}
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
  const [sheetSession, setSheetSession] = useState<{ item: ScheduledSession; index: number } | null>(null);

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

  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);

  const logsForDate = (date: Date) =>
    logs.filter((l) => isSameDay(l.date.toDate(), date));

  const scheduledForDate = (date: Date): ScheduledSession[] =>
    program ? getScheduledSessionsForDate(program, date) : [];

  const selectedLogs = logsForDate(selected);
  const selectedScheduled = scheduledForDate(selected);

  // Totals for the week containing the selected day.
  const weekTotals = (() => {
    const start = startOfWeek(selected, { weekStartsOn: 1 });
    const week = eachDayOfInterval({ start, end: endOfWeek(selected, { weekStartsOn: 1 }) });
    let planned = 0, logged = 0, minutes = 0, load = 0;
    for (const d of week) {
      planned += scheduledForDate(d).filter((x) => x.session.type !== "rest").length;
      for (const l of logsForDate(d)) {
        logged++;
        minutes += l.actualDurationMin ?? 0;
        load += sessionLoad(l);
      }
    }
    return { planned, logged, minutes, load: Math.round(load) };
  })();

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

      {/* Without a start date nothing can be placed on the calendar. Say so
          loudly: an empty calendar with no explanation is the failure mode this
          warning exists to prevent. */}
      {program && !program.startDate && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-amber-300">
          <span className="font-semibold">Nessuna sessione in calendario:</span> il programma
          “{program.name}” non ha una data di inizio, quindi non è possibile sapere in che
          settimana ti trovi.{" "}
          <Link href={`/programs/${program.id}/edit`} className="underline font-medium">
            Aggiungi la data di inizio
          </Link>
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
          const status = dayStatus(dayScheduled.length, dayLogs.length, day, today0);

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
              {hasDot && isCurrentMonth && status !== "empty" && (
                <span
                  className="w-1.5 h-1.5 rounded-full mt-0.5"
                  style={{ background: isSelectedDay ? "#fff" : DAY_STATUS_COLOR[status] }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        {([["done", "Svolto"], ["extra", "Fuori programma"], ["missed", "Saltato"], ["planned", "In programma"]] as const).map(
          ([k, label]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: DAY_STATUS_COLOR[k] }} />
              {label}
            </span>
          )
        )}
      </div>

      {/* D3 — the coach thinks in weeks, so summarise the selected one. */}
      <div className="flex gap-2">
        {[
          ["Sessioni", `${weekTotals.logged}/${weekTotals.planned}`],
          ["Minuti", String(weekTotals.minutes)],
          ["Carico", weekTotals.load > 0 ? String(weekTotals.load) : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex-1 bg-slate-800 rounded-xl px-3 py-2 border border-slate-700 text-center">
            <p className="text-sm font-bold text-white tabular-nums">{value}</p>
            <p className="text-[10px] text-slate-400">{label} · settimana</p>
          </div>
        ))}
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
                  {/* D9 — RPE and mood are already collected; showing them here
                      turns "trained" into "how it went" without a tap. */}
                  <p className="text-xs text-slate-400">
                    {log.actualDurationMin} min ·{" "}
                    <span style={{ color: RPE_COLOR(log.perceivedRPE) }}>RPE {log.perceivedRPE}</span>
                    {log.mood ? ` · ${MOOD_EMOJI[log.mood] ?? ""}` : ""}
                  </p>
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
                  onClick={() => setSheetSession({ item, index: i })}
                  className="w-full flex items-center gap-3 bg-slate-800 rounded-xl p-3 border border-slate-700 hover:border-slate-600 transition-colors text-left"
                >
                  <div className={`w-2 h-8 rounded-full shrink-0 ${sessionMeta(session.type).dot}`} />
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
        <SessionSheet
          item={sheetSession.item}
          index={sheetSession.index}
          date={selected}
          onClose={() => setSheetSession(null)}
        />
      )}
    </div>
  );
}
