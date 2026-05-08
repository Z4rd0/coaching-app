"use client";

import { useState } from "react";
import type { Cycle, Week, Session, Exercise, SessionType } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";
import ExerciseForm from "./ExerciseForm";
import { emptyExercise, emptySession, emptyWeek, emptyCycle } from "@/lib/programHelpers";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

const TYPE_COLOR: Record<string, string> = {
  strength: "bg-blue-500",
  cardio: "bg-orange-400",
  mobility: "bg-purple-400",
  rest: "bg-slate-500",
  other: "bg-slate-400",
};

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";
const selectCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-slate-400 mb-1">{label}</label>{children}</div>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  cycles: Cycle[];
  onChange: (cycles: Cycle[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgramBuilder({ cycles, onChange }: Props) {
  // Which session is expanded: "ci-wi-si" or null
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Copy-to-week picker: stores source session coords while picker is open
  const [copySource, setCopySource] = useState<{ ci: number; wi: number; si: number } | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const key = (ci: number, wi: number, si: number) => `${ci}-${wi}-${si}`;

  const update = (fn: (prev: Cycle[]) => Cycle[]) => onChange(fn(cycles));

  const updateCycle = (ci: number, fn: (c: Cycle) => Cycle) =>
    update((p) => p.map((c, i) => (i === ci ? fn(c) : c)));

  // ── Week handlers ─────────────────────────────────────────────────────────

  const addWeek = (ci: number) =>
    updateCycle(ci, (c) => ({ ...c, weeks: [...c.weeks, emptyWeek(c.weeks.length + 1)] }));

  const duplicateWeek = (ci: number, wi: number) =>
    updateCycle(ci, (c) => {
      const clone = JSON.parse(JSON.stringify(c.weeks[wi])) as Week;
      clone.weekNumber = c.weeks.length + 1;
      return { ...c, weeks: [...c.weeks, clone] };
    });

  const removeWeek = (ci: number, wi: number) =>
    updateCycle(ci, (c) => ({
      ...c,
      weeks: c.weeks.filter((_, i) => i !== wi).map((w, i) => ({ ...w, weekNumber: i + 1 })),
    }));

  // ── Session handlers ──────────────────────────────────────────────────────

  const addSession = (ci: number, wi: number) => {
    updateCycle(ci, (c) => ({
      ...c,
      weeks: c.weeks.map((w, i) => {
        if (i !== wi) return w;
        const newSessions = [...w.sessions, emptySession()];
        return { ...w, sessions: newSessions };
      }),
    }));
    // Auto-open the new session
    const newSi = cycles[ci].weeks[wi].sessions.length;
    setOpenKey(key(ci, wi, newSi));
  };

  const duplicateSession = (ci: number, wi: number, si: number) =>
    updateCycle(ci, (c) => ({
      ...c,
      weeks: c.weeks.map((w, i) => {
        if (i !== wi) return w;
        const clone = JSON.parse(JSON.stringify(w.sessions[si])) as Session;
        return { ...w, sessions: [...w.sessions, clone] };
      }),
    }));

  // Copy session to a different week
  const copySessionToWeek = (
    srcCi: number, srcWi: number, srcSi: number,
    dstCi: number, dstWi: number
  ) => {
    update((prev) => {
      const clone = JSON.parse(JSON.stringify(prev[srcCi].weeks[srcWi].sessions[srcSi])) as Session;
      return prev.map((c, ci) =>
        ci !== dstCi ? c : {
          ...c,
          weeks: c.weeks.map((w, wi) =>
            wi !== dstWi ? w : { ...w, sessions: [...w.sessions, clone] }
          ),
        }
      );
    });
    setCopySource(null);
  };

  const updateSession = (ci: number, wi: number, si: number, fn: (s: Session) => Session) =>
    updateCycle(ci, (c) => ({
      ...c,
      weeks: c.weeks.map((w, i) =>
        i === wi ? { ...w, sessions: w.sessions.map((s, j) => (j === si ? fn(s) : s)) } : w
      ),
    }));

  const removeSession = (ci: number, wi: number, si: number) => {
    if (openKey === key(ci, wi, si)) setOpenKey(null);
    updateCycle(ci, (c) => ({
      ...c,
      weeks: c.weeks.map((w, i) =>
        i === wi ? { ...w, sessions: w.sessions.filter((_, j) => j !== si) } : w
      ),
    }));
  };

  // ── Exercise handlers ─────────────────────────────────────────────────────

  const updateExercise = (ci: number, wi: number, si: number, ei: number, ex: Exercise) =>
    updateSession(ci, wi, si, (s) => ({ ...s, exercises: s.exercises.map((e, i) => (i === ei ? ex : e)) }));

  const addExercise = (ci: number, wi: number, si: number) =>
    updateSession(ci, wi, si, (s) => ({ ...s, exercises: [...s.exercises, emptyExercise()] }));

  const removeExercise = (ci: number, wi: number, si: number, ei: number) =>
    updateSession(ci, wi, si, (s) => ({ ...s, exercises: s.exercises.filter((_, i) => i !== ei) }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {cycles.map((cycle, ci) => (
        <div key={ci} className="space-y-3">
          {/* Cycle divider */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-700" />
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider px-1">
              Ciclo {cycle.cycleNumber}
            </span>
            <div className="h-px flex-1 bg-slate-700" />
          </div>

          {cycle.weeks.map((week, wi) => (
            <div key={wi} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
              {/* Week header */}
              <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Settimana {week.weekNumber}</span>
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={() => duplicateWeek(ci, wi)} className="text-slate-400 hover:text-white">
                    Duplica settimana
                  </button>
                  {cycle.weeks.length > 1 && (
                    <button type="button" onClick={() => removeWeek(ci, wi)} className="text-red-400 hover:text-red-300">
                      Elimina
                    </button>
                  )}
                  <button type="button" onClick={() => addSession(ci, wi)} className="text-primary font-medium">
                    + Sessione
                  </button>
                </div>
              </div>

              {/* Sessions */}
              {week.sessions.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-5">
                  Nessuna sessione · premi <span className="text-primary">+ Sessione</span>
                </p>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {week.sessions.map((session, si) => {
                    const k = key(ci, wi, si);
                    const isOpen = openKey === k;

                    return (
                      <div key={si}>
                        {/* ── Collapsed header (always visible) ── */}
                        <div
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isOpen ? "bg-slate-750" : "hover:bg-slate-700/30"}`}
                          onClick={() => setOpenKey(isOpen ? null : k)}
                        >
                          {/* Type dot */}
                          <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_COLOR[session.type] || "bg-slate-500"}`} />

                          {/* Summary */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {session.scheduledDate ? (
                                <span className="text-xs font-medium text-primary">
                                  📅 {session.scheduledDate}
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-400">{DAYS[session.dayOfWeek]}</span>
                              )}
                              <span className="text-xs text-slate-600">·</span>
                              <span className="text-xs text-slate-400">{SESSION_TYPE_LABELS[session.type]}</span>
                              {session.title && (
                                <>
                                  <span className="text-xs text-slate-600">·</span>
                                  <span className="text-xs font-semibold text-white truncate">{session.title}</span>
                                </>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {session.exercises.length} esercizi · {session.durationMin} min · RPE {session.targetRPE}
                            </p>
                          </div>

                          {/* Actions (stop propagation so they don't toggle) */}
                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              title="Duplica in questa settimana"
                              onClick={() => duplicateSession(ci, wi, si)}
                              className="text-slate-500 hover:text-slate-300 p-1"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              title="Copia in altra settimana"
                              onClick={() => setCopySource(copySource && copySource.ci === ci && copySource.wi === wi && copySource.si === si ? null : { ci, wi, si })}
                              className={`p-1 transition-colors ${copySource?.ci === ci && copySource?.wi === wi && copySource?.si === si ? "text-primary" : "text-slate-500 hover:text-slate-300"}`}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              title="Elimina sessione"
                              onClick={() => removeSession(ci, wi, si)}
                              className="text-slate-600 hover:text-red-400 p-1"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          {/* Expand chevron */}
                          <svg
                            className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>

                        {/* ── Copy-to-week picker ── */}
                        {copySource?.ci === ci && copySource?.wi === wi && copySource?.si === si && (
                          <div className="bg-slate-900/60 px-4 py-3 border-t border-slate-700/50">
                            <p className="text-xs text-slate-400 mb-2 font-medium">Copia in settimana:</p>
                            <div className="flex flex-wrap gap-2">
                              {cycles.flatMap((c, dci) =>
                                c.weeks.map((w, dwi) => {
                                  const isSelf = dci === ci && dwi === wi;
                                  return (
                                    <button
                                      key={`${dci}-${dwi}`}
                                      type="button"
                                      disabled={isSelf}
                                      onClick={() => copySessionToWeek(ci, wi, si, dci, dwi)}
                                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                                        isSelf
                                          ? "border-slate-700 text-slate-600 cursor-default"
                                          : "border-slate-600 text-slate-300 hover:border-primary hover:text-primary"
                                      }`}
                                    >
                                      {cycles.length > 1 ? `C${c.cycleNumber} · ` : ""}S{w.weekNumber}
                                    </button>
                                  );
                                })
                              )}
                              <button
                                type="button"
                                onClick={() => setCopySource(null)}
                                className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-300"
                              >
                                Annulla
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ── Expanded form ── */}
                        {isOpen && (
                          <div className="px-4 py-4 space-y-3 border-t border-slate-700/50 bg-slate-900/30">
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Giorno">
                                <select
                                  value={session.dayOfWeek}
                                  onChange={(e) => updateSession(ci, wi, si, (s) => ({ ...s, dayOfWeek: +e.target.value }))}
                                  className={selectCls}
                                >
                                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                </select>
                              </Field>
                              <Field label="Tipo">
                                <select
                                  value={session.type}
                                  onChange={(e) => updateSession(ci, wi, si, (s) => ({ ...s, type: e.target.value as SessionType }))}
                                  className={selectCls}
                                >
                                  {(Object.entries(SESSION_TYPE_LABELS) as [SessionType, string][]).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                  ))}
                                </select>
                              </Field>
                            </div>

                            <Field label="Data specifica (opzionale — sovrascrive il giorno)">
                              <div className="flex gap-2">
                                <input
                                  type="date"
                                  value={session.scheduledDate ?? ""}
                                  onChange={(e) => updateSession(ci, wi, si, (s) => ({
                                    ...s,
                                    scheduledDate: e.target.value || undefined,
                                  }))}
                                  className={`${selectCls} flex-1`}
                                />
                                {session.scheduledDate && (
                                  <button
                                    type="button"
                                    onClick={() => updateSession(ci, wi, si, (s) => ({ ...s, scheduledDate: undefined }))}
                                    className="px-3 py-1.5 text-xs text-slate-400 border border-slate-600 rounded-lg hover:text-white"
                                  >
                                    Rimuovi
                                  </button>
                                )}
                              </div>
                            </Field>

                            <Field label="Titolo sessione">
                              <input
                                value={session.title}
                                onChange={(e) => updateSession(ci, wi, si, (s) => ({ ...s, title: e.target.value }))}
                                placeholder="Es. Squat + Upper"
                                className={inputCls}
                              />
                            </Field>

                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Target RPE (1-10)">
                                <input
                                  type="number" min={1} max={10}
                                  value={session.targetRPE}
                                  onChange={(e) => updateSession(ci, wi, si, (s) => ({ ...s, targetRPE: +e.target.value }))}
                                  className={inputCls}
                                />
                              </Field>
                              <Field label="Durata (min)">
                                <input
                                  type="number" min={1}
                                  value={session.durationMin}
                                  onChange={(e) => updateSession(ci, wi, si, (s) => ({ ...s, durationMin: +e.target.value }))}
                                  className={inputCls}
                                />
                              </Field>
                            </div>

                            {/* Exercises */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Esercizi</span>
                                <button
                                  type="button"
                                  onClick={() => addExercise(ci, wi, si)}
                                  className="text-primary text-xs font-medium"
                                >
                                  + Aggiungi
                                </button>
                              </div>
                              {session.exercises.map((ex, ei) => (
                                <ExerciseForm
                                  key={ei}
                                  exercise={ex}
                                  index={ei}
                                  canRemove={session.exercises.length > 1}
                                  onChange={(updated) => updateExercise(ci, wi, si, ei, updated)}
                                  onRemove={() => removeExercise(ci, wi, si, ei)}
                                />
                              ))}
                            </div>

                            <Field label="Note sessione">
                              <textarea
                                rows={2}
                                value={session.notes}
                                onChange={(e) => updateSession(ci, wi, si, (s) => ({ ...s, notes: e.target.value }))}
                                placeholder="Note opzionali…"
                                className={`${inputCls} resize-none`}
                              />
                            </Field>

                            <button
                              type="button"
                              onClick={() => setOpenKey(null)}
                              className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 border border-slate-700 rounded-xl transition-colors"
                            >
                              Chiudi sessione ↑
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => addWeek(ci)}
            className="w-full py-2 border border-dashed border-slate-600 text-slate-400 text-sm rounded-xl hover:border-slate-500 hover:text-slate-300 transition-colors"
          >
            + Aggiungi settimana
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...cycles, emptyCycle(cycles.length + 1)])}
        className="w-full py-2 border border-dashed border-slate-600 text-slate-400 text-sm rounded-xl hover:border-slate-500 hover:text-slate-300 transition-colors"
      >
        + Aggiungi ciclo
      </button>
    </div>
  );
}
