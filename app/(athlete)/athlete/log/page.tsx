"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import {
  getActiveAthleteProgram,
  getTodaySession,
  createLog,
  getGroupsForAthlete,
  getActiveGroupProgram,
} from "@/lib/firestore";
import type { Group, Cycle, Session, WorkoutLog, ExerciseLog, CardioLog, CircuitLog, HiitLog } from "@/types";
import { MOOD_LABELS, ENERGY_LABELS, SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import HiitTimer from "@/components/HiitTimer";

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "block text-xs text-slate-400 mb-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelCls}>{label}</label>{children}</div>;
}

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

/** A selectable session from one of the athlete's programs (personal or group).
 *  The athlete picks freely which workout they did — never bound to the calendar day. */
interface SessionOption {
  key: string;
  session: Session;
  programId: string;
  groupId?: string;
  groupName?: string;
  /** optgroup label in the select */
  sourceLabel: string;
  label: string;
}

function optionsFromProgram(
  programId: string,
  programName: string,
  cycles: Cycle[],
  groupId?: string,
  groupName?: string
): SessionOption[] {
  const sourceLabel = groupName ? `👥 ${groupName} · ${programName}` : programName;
  const multiCycle = cycles.length > 1;
  const opts: SessionOption[] = [];
  cycles.forEach((cycle, ci) =>
    cycle.weeks.forEach((week, wi) =>
      week.sessions.forEach((session, si) => {
        if (session.type === "rest") return;
        opts.push({
          key: `${groupId ?? "p"}|${programId}|${ci}|${wi}|${si}`,
          session,
          programId,
          groupId,
          groupName,
          sourceLabel,
          label: `${multiCycle ? `C${cycle.cycleNumber}·` : ""}Sett. ${week.weekNumber} · ${DAYS[session.dayOfWeek]} · ${session.title || SESSION_TYPE_LABELS[session.type]}`,
        });
      })
    )
  );
  return opts;
}

function initExerciseLogs(session: Session): ExerciseLog[] {
  return session.exercises.map((ex) => ({
    name: ex.name,
    plannedSets: ex.sets,
    plannedReps: ex.reps,
    plannedLoad: ex.load,
    actualSets: ex.sets,
    actualReps: ex.reps,
    actualLoad: ex.load,
    notes: "",
  }));
}

const emptyCardioLog = (): CardioLog => ({
  hrZoneMinutes: {},
});

export default function AthleteLogPage() {
  const { user, athleteAccess } = useAuth();
  const router = useRouter();

  const [options, setOptions] = useState<SessionOption[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [freeType, setFreeType] = useState<"strength" | "cardio">("strength");
  const [durationMin, setDurationMin] = useState(60);
  const [rpe, setRpe] = useState(7);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [notes, setNotes] = useState("");
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLog[]>([]);
  const [cardioLog, setCardioLog] = useState<CardioLog>(emptyCardioLog());
  const [distanceKm, setDistanceKm] = useState("");
  const [circuitLog, setCircuitLog] = useState<CircuitLog>({ roundsCompleted: 1 });
  const [hiitLog, setHiitLog] = useState<HiitLog>({ roundsCompleted: 0 });
  const [showHiitTimer, setShowHiitTimer] = useState(false);
  const [activeTimer, setActiveTimer] = useState<{ label: string; remaining: number; total: number } | null>(null);

  const applySelection = (key: string, opts: SessionOption[]) => {
    setSelectedKey(key);
    const s = opts.find((o) => o.key === key)?.session ?? null;
    if (s && s.exercises.length > 0) setExerciseLogs(initExerciseLogs(s));
    else setExerciseLogs([]);
    if (s) setDurationMin(s.durationMin);
  };

  useEffect(() => {
    if (!user || !athleteAccess) return;
    const { coachId, athleteId } = athleteAccess;
    (async () => {
      const [prog, grps] = await Promise.all([
        getActiveAthleteProgram(coachId, athleteId),
        getGroupsForAthlete(coachId, user.uid),
      ]);
      setGroups(grps);
      const groupProgs = await Promise.all(
        grps.map(async (g) => ({ g, p: await getActiveGroupProgram(coachId, g.id) }))
      );

      const opts: SessionOption[] = [];
      if (prog) opts.push(...optionsFromProgram(prog.id, prog.name, prog.cycles));
      for (const { g, p } of groupProgs) {
        if (p) opts.push(...optionsFromProgram(p.id, p.name, p.cycles, g.id, g.name));
      }
      setOptions(opts);

      // Pre-select today's planned session as a convenience — just a suggestion,
      // the athlete can switch to any session (or none) regardless of the day
      let suggested: Session | null = prog ? getTodaySession(prog) : null;
      if (!suggested) {
        for (const { p } of groupProgs) {
          if (p) { suggested = getTodaySession(p); if (suggested) break; }
        }
      }
      const suggestedKey = suggested
        ? opts.find((o) => o.session === suggested)?.key
        : undefined;
      if (suggestedKey) applySelection(suggestedKey, opts);
    })().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, athleteAccess]);

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

  const selectedOption = options.find((o) => o.key === selectedKey) ?? null;
  const selectedSession = selectedOption?.session ?? null;

  const sessionType = selectedSession?.type ?? freeType;
  const showStrength = (sessionType === "strength" || sessionType === "mobility" || sessionType === "other") && (selectedSession?.exercises.length ?? 0) > 0;
  const showCardio = sessionType === "cardio";
  const showCircuit = sessionType === "circuit";
  const showHiit = sessionType === "hiit";

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
    if (!user || !athleteAccess) return;
    const { coachId, athleteId } = athleteAccess;
    setSaving(true);
    setError("");

    try {
      const hasCardio = showCardio && (cardioLog.avgHeartRate || cardioLog.maxHeartRate || cardioLog.distanceMeters || cardioLog.calories);
      const finalCardio: CardioLog | undefined = hasCardio ? {
        ...cardioLog,
        distanceMeters: distanceKm ? Math.round(parseFloat(distanceKm) * 1000) : undefined,
      } : undefined;

      const hasExerciseLogs = (showStrength || showCircuit) && exerciseLogs.length > 0;
      const finalCircuit: CircuitLog | undefined = showCircuit ? circuitLog : undefined;
      const finalHiit: HiitLog | undefined = showHiit ? hiitLog : undefined;

      const logData: Omit<WorkoutLog, "id" | "createdAt"> = {
        date: Timestamp.fromDate(new Date(logDate + "T12:00:00")),
        ...(selectedOption ? { programId: selectedOption.programId } : {}),
        ...(selectedOption?.groupId ? { groupId: selectedOption.groupId } : {}),
        ...(selectedSession ? { plannedSession: selectedSession } : {}),
        actualDurationMin: durationMin,
        perceivedRPE: rpe,
        mood,
        energyLevel: energy,
        notes,
        writtenBy: "athlete",
        ...(hasExerciseLogs ? { exerciseLogs } : {}),
        ...(finalCardio ? { cardioLog: finalCardio } : {}),
        ...(finalCircuit ? { circuitLog: finalCircuit } : {}),
        ...(finalHiit ? { hiitLog: finalHiit } : {}),
      };

      const docRef = await createLog(coachId, athleteId, logData);

      // Fire-and-forget: share with the athlete's groups + update leaderboard.
      // Server-side: the feed entry is built from the saved log (anti-cheating).
      if (groups.length > 0) {
        user
          .getIdToken()
          .then((idToken) =>
            fetch("/api/group-feed", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ logId: docRef.id }),
            })
          )
          .catch(() => {});
      }

      router.push("/athlete/history");
    } catch {
      setError("Errore nel salvataggio. Riprova.");
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Log allenamento</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Scegli quale sessione hai fatto — quando vuoi tu, non conta il giorno.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Session picker (day-independent) ── */}
        {options.length > 0 && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <label className="block text-xs text-slate-400 mb-1.5">Allenamento</label>
            <select
              value={selectedKey}
              onChange={(e) => applySelection(e.target.value, options)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Sessione libera (fuori programma)</option>
              {Array.from(new Set(options.map((o) => o.sourceLabel))).map((src) => (
                <optgroup key={src} label={src}>
                  {options.filter((o) => o.sourceLabel === src).map((o) => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {selectedSession && (
              <p className="text-xs text-slate-500 mt-2">
                {SESSION_TYPE_LABELS[selectedSession.type]} · {selectedSession.exercises.length} esercizi · {selectedSession.durationMin} min · RPE target {selectedSession.targetRPE}
                {selectedOption?.groupName && (
                  <span className="text-primary"> · 👥 {selectedOption.groupName}</span>
                )}
              </p>
            )}
          </div>
        )}

        {/* ── Date picker ── */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <label className="block text-xs text-slate-400 mb-1.5">Data allenamento</label>
          <input
            type="date"
            value={logDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setLogDate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {!selectedSession && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <p className={labelCls}>Tipo di allenamento</p>
            <div className="flex gap-2">
              {(["strength", "cardio"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setFreeType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${freeType === t ? "bg-primary text-white" : "bg-slate-700 text-slate-300"}`}>
                  {t === "strength" ? "💪 Forza / Mobilità" : "🏃 Cardio / Corsa"}
                </button>
              ))}
            </div>
          </div>
        )}

        {showStrength && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Esercizi</p>
            {exerciseLogs.map((ex, i) => {
              const restSec = selectedSession?.exercises[i]?.restSeconds;
              return (
                <div key={i} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{ex.name}</span>
                    <span className="text-xs text-slate-500">prev. {ex.plannedSets}×{ex.plannedReps}{ex.plannedLoad ? ` @ ${ex.plannedLoad}` : ""}</span>
                  </div>
                  <div className="px-4 py-3 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Serie">
                        <input type="number" min={0} value={ex.actualSets ?? ""} onChange={(e) => updateExLog(i, { actualSets: e.target.value ? +e.target.value : undefined })} className={inputCls} />
                      </Field>
                      <Field label="Reps">
                        <input value={ex.actualReps ?? ""} onChange={(e) => updateExLog(i, { actualReps: e.target.value })} placeholder="8,7,7" className={inputCls} />
                      </Field>
                      <Field label="Carico">
                        <input value={ex.actualLoad ?? ""} onChange={(e) => updateExLog(i, { actualLoad: e.target.value })} placeholder="80kg" className={inputCls} />
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
                      <label className={labelCls}>Note</label>
                      <input value={ex.notes ?? ""} onChange={(e) => updateExLog(i, { notes: e.target.value })} placeholder="Sensazioni, tecnica…" className={inputCls} />
                    </div>
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
            <div className="bg-slate-800 rounded-2xl p-4 border border-yellow-400/30">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-white">
                  Round completati
                  {selectedSession?.targetRounds && <span className="text-xs text-slate-400 font-normal ml-2">(target: {selectedSession.targetRounds})</span>}
                </label>
                <span className="text-xl font-bold text-yellow-400">{circuitLog.roundsCompleted}</span>
              </div>
              <input type="range" min={1} max={20} step={1} value={circuitLog.roundsCompleted} onChange={(e) => setCircuitLog((p) => ({ ...p, roundsCompleted: +e.target.value }))} className="w-full accent-yellow-400" />
              <div className="flex justify-between text-xs text-slate-500 mt-1"><span>1</span><span>10</span><span>20</span></div>
            </div>

            {exerciseLogs.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Esercizi del circuit</p>
                {exerciseLogs.map((ex, i) => (
                  <div key={i} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{ex.name}</span>
                      <span className="text-xs text-slate-500">{ex.plannedReps} reps{ex.plannedLoad ? ` · ${ex.plannedLoad}` : ""}</span>
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

            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
              <Field label="Recupero effettivo tra round (sec)">
                <input type="number" min={0} value={circuitLog.restBetweenRoundsSeconds ?? ""} onChange={(e) => setCircuitLog((p) => ({ ...p, restBetweenRoundsSeconds: e.target.value ? +e.target.value : undefined }))} placeholder={selectedSession?.restBetweenRoundsSeconds?.toString() ?? "90"} className={inputCls} />
              </Field>
              {(circuitLog.restBetweenRoundsSeconds ?? selectedSession?.restBetweenRoundsSeconds) && (
                <button
                  type="button"
                  onClick={() => startTimer(circuitLog.restBetweenRoundsSeconds ?? selectedSession?.restBetweenRoundsSeconds ?? 90, "Recupero round")}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-yellow-400/40 text-yellow-400 text-sm hover:bg-yellow-400/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 3" />
                  </svg>
                  Avvia recupero round
                </button>
              )}
            </div>

            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Metriche cardio</p>
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
                      <input type="number" min={0} value={circuitLog.hrZoneMinutes?.[z] ?? ""} onChange={(e) => setCircuitLog((p) => ({ ...p, hrZoneMinutes: { ...p.hrZoneMinutes, [z]: e.target.value ? +e.target.value : undefined } }))} placeholder="0" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-1 py-2 text-sm text-white text-center placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {showCardio && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Metriche cardio</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="FC media (bpm)">
                <input type="number" min={0} value={cardioLog.avgHeartRate ?? ""} onChange={(e) => updateCardio({ avgHeartRate: e.target.value ? +e.target.value : undefined })} placeholder="150" className={inputCls} />
              </Field>
              <Field label="FC max (bpm)">
                <input type="number" min={0} value={cardioLog.maxHeartRate ?? ""} onChange={(e) => updateCardio({ maxHeartRate: e.target.value ? +e.target.value : undefined })} placeholder="178" className={inputCls} />
              </Field>
              <Field label="Distanza (km)">
                <input type="number" min={0} step="0.01" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} placeholder="10.5" className={inputCls} />
              </Field>
              <Field label="Passo medio (min/km)">
                <input value={cardioLog.avgPaceMinPerKm ?? ""} onChange={(e) => updateCardio({ avgPaceMinPerKm: e.target.value })} placeholder="5:30" className={inputCls} />
              </Field>
            </div>
            <div>
              <label className={labelCls}>Minuti per zona</label>
              <div className="grid grid-cols-5 gap-1.5">
                {(["z1","z2","z3","z4","z5"] as const).map((z, idx) => (
                  <div key={z} className="text-center">
                    <div className={`text-[10px] font-semibold mb-1 ${["text-blue-400","text-green-400","text-yellow-400","text-orange-400","text-red-400"][idx]}`}>Z{idx+1}</div>
                    <input type="number" min={0} value={cardioLog.hrZoneMinutes?.[z] ?? ""} onChange={(e) => updateZone(z, e.target.value)} placeholder="0" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-1 py-2 text-sm text-white text-center placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── HIIT section ── */}
        {showHiit && (
          <div className="space-y-3">
            {selectedSession?.hiitBlocks && selectedSession.hiitBlocks.length > 0 && (
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

            <div className="bg-slate-800 rounded-2xl p-4 border border-rose-500/20">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-white">
                  Round completati
                  {selectedSession?.hiitBlocks && (
                    <span className="text-xs text-slate-400 font-normal ml-2">
                      (target: {selectedSession.hiitBlocks.reduce((s, b) => s + b.rounds, 0)})
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
              <p className="text-xs text-slate-400 text-center">
                Tempo totale:{" "}
                {String(Math.floor(hiitLog.totalTimeSeconds / 60)).padStart(2, "0")}:{String(hiitLog.totalTimeSeconds % 60).padStart(2, "0")}
              </p>
            )}

            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Metriche</p>
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

        {/* Duration */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-white">Durata effettiva</label>
            <span className="text-xl font-bold text-primary">{durationMin} min</span>
          </div>
          <input type="range" min={5} max={180} step={5} value={durationMin} onChange={(e) => setDurationMin(+e.target.value)} className="w-full accent-primary" />
          <div className="flex justify-between text-xs text-slate-500 mt-1"><span>5</span><span>90</span><span>180</span></div>
        </div>

        {/* RPE */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-white">RPE percepito{selectedSession && <span className="text-xs text-slate-400 font-normal ml-2">(target: {selectedSession.targetRPE})</span>}</label>
            <span className="text-xl font-bold text-primary">{rpe}/10</span>
          </div>
          <input type="range" min={1} max={10} step={1} value={rpe} onChange={(e) => setRpe(+e.target.value)} className="w-full accent-primary" />
          <div className="flex justify-between text-xs text-slate-500 mt-1">{[1,2,3,4,5,6,7,8,9,10].map(n => <span key={n}>{n}</span>)}</div>
        </div>

        {/* Mood */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <label className="text-sm font-semibold text-white block mb-3">Umore</label>
          <div className="flex justify-between">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => setMood(n)}
                className={`text-3xl p-2 rounded-xl transition-all ${mood === n ? "bg-primary/20 scale-110" : "opacity-50"}`}>
                {MOOD_LABELS[n]}
              </button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <label className="text-sm font-semibold text-white block mb-3">Livello energia</label>
          <div className="flex justify-between">
            {[1,2,3,4,5].map(n => (
              <button key={n} type="button" onClick={() => setEnergy(n)}
                className={`text-3xl p-2 rounded-xl transition-all ${energy === n ? "bg-primary/20 scale-110" : "opacity-50"}`}>
                {ENERGY_LABELS[n]}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <label className="text-sm font-semibold text-white block mb-2">Note</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Come ti sei sentito? Difficoltà, PR, osservazioni…"
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>

        {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

        <button type="submit" disabled={saving}
          className="w-full bg-primary disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-base">
          {saving ? "Salvataggio…" : "Salva allenamento ✨"}
        </button>
      </form>

      {/* ── HIIT timer overlay ── */}
      {showHiitTimer && selectedSession?.hiitBlocks && selectedSession.hiitBlocks.length > 0 && (
        <HiitTimer
          blocks={selectedSession.hiitBlocks}
          onClose={(rounds, totalSeconds) => {
            setHiitLog((p) => ({ ...p, roundsCompleted: rounds, totalTimeSeconds: totalSeconds }));
            setShowHiitTimer(false);
          }}
        />
      )}

      {/* ── Rest timer overlay ── */}
      {activeTimer && (
        <div className={`fixed bottom-20 left-4 right-4 z-50 rounded-2xl p-4 shadow-2xl border transition-all ${
          activeTimer.remaining === 0
            ? "bg-green-600/20 border-green-500/40"
            : "bg-slate-800 border-primary/40"
        }`}>
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
