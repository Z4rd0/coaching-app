"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveProgram, getTodaySession, createLog } from "@/lib/firestore";
import type { Program, Session, WorkoutLog, ExerciseLog, CardioLog, CircuitLog, HiitLog } from "@/types";
import { MOOD_LABELS, ENERGY_LABELS, SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import HiitTimer from "@/components/HiitTimer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-lg px-3 py-2.5 text-[13px] outline-none transition-colors focus:ring-1 focus:ring-[var(--green-primary)]"
  + " bg-[var(--bg-surface-2)] border border-[rgba(148,163,184,0.08)] text-[var(--text-primary)] placeholder:text-[var(--text-faint)]";
const labelCls = "block text-[11px] font-medium text-[var(--text-faint)] mb-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelCls}>{label}</label>{children}</div>;
}

function isCardioType(type?: Session["type"]) {
  return type === "cardio";
}
function isStrengthType(type?: Session["type"]) {
  return !type || type === "strength" || type === "mobility" || type === "other";
}

// Build initial exerciseLogs from planned session
function initExerciseLogs(session: Session): ExerciseLog[] {
  return session.exercises.map((ex) => ({
    name: ex.name,
    plannedSets: ex.sets,
    plannedReps: ex.reps,
    plannedLoad: ex.load,
    actualSets: ex.sets,
    actualReps: ex.reps,
    actualLoad: ex.load,
    rpe: undefined,
    notes: "",
  }));
}

const emptyCardioLog = (): CardioLog => ({
  avgHeartRate: undefined,
  maxHeartRate: undefined,
  distanceMeters: undefined,
  avgPaceMinPerKm: "",
  calories: undefined,
  hrZoneMinutes: { z1: undefined, z2: undefined, z3: undefined, z4: undefined, z5: undefined },
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LogPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [program, setProgram] = useState<Program | null>(null);
  const [todaySession, setTodaySession] = useState<Session | null>(null);
  const [logDate, setLogDate] = useState<string>(
    searchParams.get("date") ?? new Date().toISOString().slice(0, 10)
  );
  // When set (ISO "YYYY-MM-DD"), locks which planned session we're logging,
  // decoupled from the actual log date — lets you log an upcoming session on a
  // different day. Without it, the session follows the chosen date (default flow).
  const plannedDate = searchParams.get("session");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Free-session type override (when no planned session)
  const [freeType, setFreeType] = useState<"strength" | "cardio">("strength");

  // Overall metrics
  const [durationMin, setDurationMin] = useState(60);
  const [rpe, setRpe] = useState(7);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [notes, setNotes] = useState("");

  // Exercise-by-exercise log
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);

  // Cardio metrics
  const [cardioLog, setCardioLog] = useState<CardioLog>(emptyCardioLog());
  const [distanceKm, setDistanceKm] = useState("");

  // Circuit
  const [circuitLog, setCircuitLog] = useState<CircuitLog>({ roundsCompleted: 1 });

  // HIIT
  const [hiitLog, setHiitLog] = useState<HiitLog>({ roundsCompleted: 0 });
  const [showHiitTimer, setShowHiitTimer] = useState(false);

  // Rest timer
  const [activeTimer, setActiveTimer] = useState<{ label: string; remaining: number; total: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    getActiveProgram(user.uid).then((prog) => {
      setProgram(prog);
      if (prog) {
        // A planned session (from "Prossimi giorni") wins; otherwise the
        // session is the one falling on the chosen log date.
        const s = getTodaySession(prog, new Date((plannedDate ?? logDate) + "T12:00:00"));
        setTodaySession(s);
        if (s && s.exercises.length > 0) setExerciseLogs(initExerciseLogs(s));
        if (s) setDurationMin(s.durationMin);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    // When logging a specific planned session, the session is locked — changing
    // the actual log date must not swap it out.
    if (!program || plannedDate) return;
    const s = getTodaySession(program, new Date(logDate + "T12:00:00"));
    setTodaySession(s);
    if (s && s.exercises.length > 0) setExerciseLogs(initExerciseLogs(s));
    else setExerciseLogs([]);
    if (s) setDurationMin(s.durationMin);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logDate]);

  // Rest timer countdown
  useEffect(() => {
    if (!activeTimer) return;
    if (activeTimer.remaining <= 0) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      const t = setTimeout(() => setActiveTimer(null), 3000);
      return () => clearTimeout(t);
    }
    const interval = setInterval(() => {
      setActiveTimer((prev) => prev ? { ...prev, remaining: prev.remaining - 1 } : null);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer?.remaining]);

  const startTimer = (seconds: number, label: string) =>
    setActiveTimer({ label, remaining: seconds, total: seconds });

  // Which mode are we in?
  const sessionType = todaySession?.type ?? freeType;
  const showStrength = isStrengthType(sessionType) && (todaySession?.exercises.length ?? 0) > 0;
  const showCardio = isCardioType(sessionType);
  const showCircuit = sessionType === "circuit";
  const showHiit = sessionType === "hiit";

  // Update a single exercise log field
  const updateExLog = (i: number, patch: Partial<ExerciseLog>) =>
    setExerciseLogs((prev) => prev.map((el, idx) => idx === i ? { ...el, ...patch } : el));

  const updateCardio = (patch: Partial<CardioLog>) =>
    setCardioLog((prev) => ({ ...prev, ...patch }));

  const updateZone = (z: keyof NonNullable<CardioLog["hrZoneMinutes"]>, val: string) =>
    setCardioLog((prev) => ({
      ...prev,
      hrZoneMinutes: { ...prev.hrZoneMinutes, [z]: val ? +val : undefined },
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");

    try {
      // Build cardio log only if filled
      const hasCardio = showCardio && (
        cardioLog.avgHeartRate || cardioLog.maxHeartRate ||
        cardioLog.distanceMeters || cardioLog.calories
      );

      const finalCardio: CardioLog | undefined = hasCardio ? {
        ...cardioLog,
        distanceMeters: distanceKm ? Math.round(parseFloat(distanceKm) * 1000) : undefined,
      } : undefined;

      const hasExerciseLogs = (showStrength || showCircuit) && exerciseLogs.length > 0;

      const finalCircuit: CircuitLog | undefined = showCircuit ? circuitLog : undefined;
      const finalHiit: HiitLog | undefined = showHiit ? hiitLog : undefined;

      const logData: Omit<WorkoutLog, "id" | "createdAt"> = {
        date: Timestamp.fromDate(new Date(logDate + "T12:00:00")),
        ...(program?.id ? { programId: program.id } : {}),
        ...(todaySession ? { plannedSession: todaySession } : {}),
        actualDurationMin: durationMin,
        perceivedRPE: rpe,
        mood,
        energyLevel: energy,
        notes,
        ...(hasExerciseLogs ? { exerciseLogs } : {}),
        ...(finalCardio ? { cardioLog: finalCardio } : {}),
        ...(finalCircuit ? { circuitLog: finalCircuit } : {}),
        ...(finalHiit ? { hiitLog: finalHiit } : {}),
      };

      const docRef = await createLog(user.uid, user.uid, logData);

      router.push(`/history/${docRef.id}`);
    } catch (err: unknown) {
      console.error("createLog error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Errore nel salvataggio: ${msg}`);
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-5 pt-6 pb-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>Log allenamento</h1>
        {todaySession ? (
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            📅 <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{todaySession.title || SESSION_TYPE_LABELS[todaySession.type]}</span>
            {" · "}{SESSION_TYPE_LABELS[todaySession.type]}
          </p>
        ) : (
          <p className="text-[13px] mt-0.5" style={{ color: "var(--text-muted)" }}>Sessione libera</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Date picker ── */}
        <div className="card p-4">
          <label className={labelCls}>Data allenamento</label>
          <input
            type="date"
            value={logDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setLogDate(e.target.value)}
            className={inputCls}
          />
          {plannedDate && (
            <p className="text-[11px] mt-2" style={{ color: "var(--text-faint)" }}>
              📋 Stai registrando una sessione programmata. Imposta qui il giorno in cui l&apos;hai effettivamente svolta (default: oggi).
            </p>
          )}
        </div>

        {/* ── Free session type toggle ── */}
        {!todaySession && (
          <div className="card p-4">
            <p className={labelCls}>Tipo di allenamento</p>
            <div className="flex gap-2">
              {(["strength", "cardio"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFreeType(t)}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                  style={freeType === t
                    ? { background: "var(--green-primary)", color: "#fff" }
                    : { background: "var(--bg-surface-3)", color: "var(--text-muted)" }
                  }
                >
                  {t === "strength" ? "💪 Forza / Mobilità" : "🏃 Cardio / Corsa"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Exercise-by-exercise (Strength) ── */}
        {showStrength && (
          <div className="space-y-3">
            <p className="text-xs font-semibold section-label">Esercizi</p>
            {exerciseLogs.map((ex, i) => {
              const restSec = todaySession?.exercises[i]?.restSeconds;
              return (
                <div key={i} className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{ex.name}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                      prev. {ex.plannedSets}×{ex.plannedReps}
                      {ex.plannedLoad ? ` @ ${ex.plannedLoad}` : ""}
                    </span>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Serie effettive">
                        <input type="number" min={0} value={ex.actualSets ?? ""} onChange={(e) => updateExLog(i, { actualSets: e.target.value ? +e.target.value : undefined })} className={inputCls} />
                      </Field>
                      <Field label="Reps">
                        <input value={ex.actualReps ?? ""} onChange={(e) => updateExLog(i, { actualReps: e.target.value })} placeholder="es. 8,7,7" className={inputCls} />
                      </Field>
                      <Field label="Carico">
                        <input value={ex.actualLoad ?? ""} onChange={(e) => updateExLog(i, { actualLoad: e.target.value })} placeholder="es. 80kg" className={inputCls} />
                      </Field>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={labelCls + " mb-0"}>RPE esercizio</label>
                        <span className="text-sm font-bold text-primary">{ex.rpe ?? "—"}</span>
                      </div>
                      <input type="range" min={1} max={10} step={1} value={ex.rpe ?? 5} onChange={(e) => updateExLog(i, { rpe: +e.target.value })} onMouseDown={() => { if (!ex.rpe) updateExLog(i, { rpe: 5 }); }} className="w-full accent-primary" />
                      <div className="flex justify-between text-[10px] text-slate-600 -mt-0.5">
                        {[1,2,3,4,5,6,7,8,9,10].map(n => <span key={n}>{n}</span>)}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Note (opzionale)</label>
                      <input value={ex.notes ?? ""} onChange={(e) => updateExLog(i, { notes: e.target.value })} placeholder="Difficoltà, sensazioni, tecnica…" className={inputCls} />
                    </div>
                    {/* Rest timer button */}
                    {restSec && (
                      <button
                        type="button"
                        onClick={() => startTimer(restSec, ex.name)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm hover:border-primary hover:text-primary transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" />
                        </svg>
                        Avvia recupero · {restSec >= 60 ? `${restSec / 60}m` : `${restSec}s`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Circuit mode ── */}
        {showCircuit && (
          <div className="space-y-3">
            {/* Round counter */}
            <div className="card p-4" style={{ borderColor: "rgba(250,204,21,0.25)" }}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Round completati
                  {todaySession?.targetRounds && <span className="text-[11px] font-normal ml-2" style={{ color: "var(--text-muted)" }}>(target: {todaySession.targetRounds})</span>}
                </label>
                <span className="text-xl font-bold text-yellow-400">{circuitLog.roundsCompleted}</span>
              </div>
              <input type="range" min={1} max={20} step={1} value={circuitLog.roundsCompleted} onChange={(e) => setCircuitLog((p) => ({ ...p, roundsCompleted: +e.target.value }))} className="w-full accent-yellow-400" />
              <div className="flex justify-between text-xs text-slate-500 mt-1"><span>1</span><span>10</span><span>20</span></div>
            </div>

            {/* Exercises per round */}
            {exerciseLogs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold section-label">Esercizi del circuit</p>
                {exerciseLogs.map((ex, i) => (
                  <div key={i} className="card overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
                      <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{ex.name}</span>
                      <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>{ex.plannedReps} reps{ex.plannedLoad ? ` · ${ex.plannedLoad}` : ""}</span>
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 gap-2">
                      <Field label="Reps effettive">
                        <input value={ex.actualReps ?? ""} onChange={(e) => updateExLog(i, { actualReps: e.target.value })} placeholder={ex.plannedReps} className={inputCls} />
                      </Field>
                      <Field label="Carico">
                        <input value={ex.actualLoad ?? ""} onChange={(e) => updateExLog(i, { actualLoad: e.target.value })} placeholder={ex.plannedLoad || "—"} className={inputCls} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recupero tra round + timer */}
            <div className="card p-4 space-y-3">
              <Field label="Recupero effettivo tra round (sec)">
                <input type="number" min={0} value={circuitLog.restBetweenRoundsSeconds ?? ""} onChange={(e) => setCircuitLog((p) => ({ ...p, restBetweenRoundsSeconds: e.target.value ? +e.target.value : undefined }))} placeholder={todaySession?.restBetweenRoundsSeconds?.toString() ?? "90"} className={inputCls} />
              </Field>
              {(circuitLog.restBetweenRoundsSeconds ?? todaySession?.restBetweenRoundsSeconds) && (
                <button
                  type="button"
                  onClick={() => startTimer(circuitLog.restBetweenRoundsSeconds ?? todaySession?.restBetweenRoundsSeconds ?? 90, "Recupero round")}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-yellow-400/40 text-yellow-400 text-sm hover:bg-yellow-400/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" />
                  </svg>
                  Avvia recupero round
                </button>
              )}
            </div>

            {/* HR / calories for circuit */}
            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold section-label">Metriche cardio</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="FC media (bpm)">
                  <input type="number" min={0} value={circuitLog.avgHeartRate ?? ""} onChange={(e) => setCircuitLog((p) => ({ ...p, avgHeartRate: e.target.value ? +e.target.value : undefined }))} placeholder="150" className={inputCls} />
                </Field>
                <Field label="FC max (bpm)">
                  <input type="number" min={0} value={circuitLog.maxHeartRate ?? ""} onChange={(e) => setCircuitLog((p) => ({ ...p, maxHeartRate: e.target.value ? +e.target.value : undefined }))} placeholder="178" className={inputCls} />
                </Field>
                <Field label="Calorie">
                  <input type="number" min={0} value={circuitLog.calories ?? ""} onChange={(e) => setCircuitLog((p) => ({ ...p, calories: e.target.value ? +e.target.value : undefined }))} placeholder="380" className={inputCls} />
                </Field>
              </div>
              <div>
                <label className={labelCls}>Minuti per zona</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(["z1","z2","z3","z4","z5"] as const).map((z, idx) => (
                    <div key={z} className="text-center">
                      <div className={`text-[10px] font-semibold mb-1 ${["text-blue-400","text-green-400","text-yellow-400","text-orange-400","text-red-400"][idx]}`}>Z{idx+1}</div>
                      <input type="number" min={0} value={circuitLog.hrZoneMinutes?.[z] ?? ""} onChange={(e) => setCircuitLog((p) => ({ ...p, hrZoneMinutes: { ...p.hrZoneMinutes, [z]: e.target.value ? +e.target.value : undefined } }))} placeholder="0" className={inputCls + " text-center px-1 py-2"} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Cardio metrics ── */}
        {showCardio && (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold section-label mb-1">Metriche cardio</p>

            <div className="grid grid-cols-2 gap-2">
              <Field label="FC media (bpm)">
                <input
                  type="number" min={0}
                  value={cardioLog.avgHeartRate ?? ""}
                  onChange={(e) => updateCardio({ avgHeartRate: e.target.value ? +e.target.value : undefined })}
                  placeholder="150"
                  className={inputCls}
                />
              </Field>
              <Field label="FC max (bpm)">
                <input
                  type="number" min={0}
                  value={cardioLog.maxHeartRate ?? ""}
                  onChange={(e) => updateCardio({ maxHeartRate: e.target.value ? +e.target.value : undefined })}
                  placeholder="178"
                  className={inputCls}
                />
              </Field>
              <Field label="Distanza (km)">
                <input
                  type="number" min={0} step="0.01"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="10.5"
                  className={inputCls}
                />
              </Field>
              <Field label="Passo medio (min/km)">
                <input
                  value={cardioLog.avgPaceMinPerKm ?? ""}
                  onChange={(e) => updateCardio({ avgPaceMinPerKm: e.target.value })}
                  placeholder="5:30"
                  className={inputCls}
                />
              </Field>
              <Field label="Calorie">
                <input
                  type="number" min={0}
                  value={cardioLog.calories ?? ""}
                  onChange={(e) => updateCardio({ calories: e.target.value ? +e.target.value : undefined })}
                  placeholder="520"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Heart rate zones */}
            <div>
              <label className={labelCls}>Minuti per zona cardiaca</label>
              <div className="grid grid-cols-5 gap-1.5">
                {(["z1","z2","z3","z4","z5"] as const).map((z, idx) => (
                  <div key={z} className="text-center">
                    <div className={`text-[10px] font-semibold mb-1 ${
                      ["text-blue-400","text-green-400","text-yellow-400","text-orange-400","text-red-400"][idx]
                    }`}>
                      Z{idx + 1}
                    </div>
                    <input
                      type="number" min={0}
                      value={cardioLog.hrZoneMinutes?.[z] ?? ""}
                      onChange={(e) => updateZone(z, e.target.value)}
                      placeholder="0"
                      className={inputCls + " text-center px-1 py-2"}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HIIT section ── */}
        {showHiit && (
          <div className="space-y-3">
            {todaySession?.hiitBlocks && todaySession.hiitBlocks.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHiitTimer(true)}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-semibold text-base hover:bg-rose-500/20 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                </svg>
                Avvia Timer HIIT
              </button>
            )}

            <div className="card p-4" style={{ borderColor: "rgba(251,113,133,0.20)" }}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  Round completati
                  {todaySession?.hiitBlocks && (
                    <span className="text-[11px] font-normal ml-2" style={{ color: "var(--text-muted)" }}>
                      (target: {todaySession.hiitBlocks.reduce((s, b) => s + b.rounds, 0)})
                    </span>
                  )}
                </label>
                <span className="text-xl font-bold text-rose-400">{hiitLog.roundsCompleted}</span>
              </div>
              <input
                type="range" min={0} max={50} step={1}
                value={hiitLog.roundsCompleted}
                onChange={(e) => setHiitLog((p) => ({ ...p, roundsCompleted: +e.target.value }))}
                className="w-full accent-rose-500"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1"><span>0</span><span>25</span><span>50</span></div>
            </div>

            {hiitLog.totalTimeSeconds != null && (
              <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
                Tempo totale:{" "}
                {String(Math.floor(hiitLog.totalTimeSeconds / 60)).padStart(2, "0")}:{String(hiitLog.totalTimeSeconds % 60).padStart(2, "0")}
              </p>
            )}

            <div className="card p-4 space-y-3">
              <p className="text-xs font-semibold section-label">Metriche</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="FC media (bpm)">
                  <input type="number" min={0} value={hiitLog.avgHeartRate ?? ""}
                    onChange={(e) => setHiitLog((p) => ({ ...p, avgHeartRate: e.target.value ? +e.target.value : undefined }))}
                    placeholder="155" className={inputCls} />
                </Field>
                <Field label="FC max (bpm)">
                  <input type="number" min={0} value={hiitLog.maxHeartRate ?? ""}
                    onChange={(e) => setHiitLog((p) => ({ ...p, maxHeartRate: e.target.value ? +e.target.value : undefined }))}
                    placeholder="185" className={inputCls} />
                </Field>
                <Field label="Calorie">
                  <input type="number" min={0} value={hiitLog.calories ?? ""}
                    onChange={(e) => setHiitLog((p) => ({ ...p, calories: e.target.value ? +e.target.value : undefined }))}
                    placeholder="450" className={inputCls} />
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* ── Duration ── */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>Durata effettiva</label>
            <span className="text-xl font-bold text-primary">{durationMin} min</span>
          </div>
          <input
            type="range" min={5} max={180} step={5}
            value={durationMin}
            onChange={(e) => setDurationMin(+e.target.value)}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>5</span><span>90</span><span>180</span>
          </div>
        </div>

        {/* ── Overall RPE ── */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
              RPE percepito globale
              {todaySession && (
                <span className="text-[11px] font-normal ml-2" style={{ color: "var(--text-muted)" }}>(target: {todaySession.targetRPE})</span>
              )}
            </label>
            <span className="text-xl font-bold text-primary">{rpe}/10</span>
          </div>
          <input
            type="range" min={1} max={10} step={1}
            value={rpe}
            onChange={(e) => setRpe(+e.target.value)}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            {[1,2,3,4,5,6,7,8,9,10].map(n => <span key={n}>{n}</span>)}
          </div>
        </div>

        {/* ── Mood ── */}
        <div className="card p-4">
          <label className="text-[14px] font-semibold block mb-3" style={{ color: "var(--text-primary)" }}>Umore</label>
          <div className="flex justify-between">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => setMood(n)}
                className={`text-3xl p-2 rounded-xl transition-all ${mood === n ? "bg-primary/20 scale-110" : "opacity-50"}`}>
                {MOOD_LABELS[n]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Energy ── */}
        <div className="card p-4">
          <label className="text-[14px] font-semibold block mb-3" style={{ color: "var(--text-primary)" }}>Livello energia</label>
          <div className="flex justify-between">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => setEnergy(n)}
                className={`text-3xl p-2 rounded-xl transition-all ${energy === n ? "bg-primary/20 scale-110" : "opacity-50"}`}>
                {ENERGY_LABELS[n]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Notes ── */}
        <div className="card p-4">
          <label className="text-[14px] font-semibold block mb-2" style={{ color: "var(--text-primary)" }}>Note generali</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Come ti sei sentito? Difficoltà, PR, osservazioni…"
            className={inputCls + " resize-none rounded-xl"}
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary disabled:opacity-60"
        >
          {saving ? "Salvataggio…" : "Salva allenamento"}
        </button>
      </form>

      {/* ── HIIT timer overlay ── */}
      {showHiitTimer && todaySession?.hiitBlocks && todaySession.hiitBlocks.length > 0 && (
        <HiitTimer
          blocks={todaySession.hiitBlocks}
          onClose={(rounds, totalSeconds) => {
            setHiitLog((p) => ({ ...p, roundsCompleted: rounds, totalTimeSeconds: totalSeconds }));
            setShowHiitTimer(false);
          }}
        />
      )}

      {/* ── Rest timer overlay ── */}
      {activeTimer && (
        <div
          className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl p-4 shadow-2xl border transition-all"
          style={activeTimer.remaining === 0
            ? { background: "rgba(22,163,74,0.15)", borderColor: "rgba(22,163,74,0.30)" }
            : { background: "var(--bg-surface-1)", borderColor: "var(--green-border)" }
          }
        >
          {activeTimer.remaining === 0 ? (
            <p className="text-green-400 font-bold text-center text-base">✓ Recupero completato!</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{activeTimer.label}</p>
                  <p className="text-3xl font-bold text-white tabular-nums leading-none">
                    {String(Math.floor(activeTimer.remaining / 60)).padStart(2, "0")}:{String(activeTimer.remaining % 60).padStart(2, "0")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTimer(null)}
                  className="text-slate-400 text-sm px-3 py-1.5 border border-slate-600 rounded-lg hover:text-white"
                >
                  Salta
                </button>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000"
                  style={{ width: `${(activeTimer.remaining / activeTimer.total) * 100}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
