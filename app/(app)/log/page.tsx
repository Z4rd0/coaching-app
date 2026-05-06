"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveProgram, getTodaySession, createLog } from "@/lib/firestore";
import type { Program, Session, WorkoutLog, ExerciseLog, CardioLog } from "@/types";
import { MOOD_LABELS, ENERGY_LABELS, SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";
const labelCls = "block text-xs text-slate-400 mb-1";

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

  const [program, setProgram] = useState<Program | null>(null);
  const [todaySession, setTodaySession] = useState<Session | null>(null);
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

  useEffect(() => {
    if (!user) return;
    getActiveProgram(user.uid).then((prog) => {
      setProgram(prog);
      if (prog) {
        const s = getTodaySession(prog);
        setTodaySession(s);
        if (s && s.exercises.length > 0) {
          setExerciseLogs(initExerciseLogs(s));
        }
        if (s) setDurationMin(s.durationMin);
      }
      setLoading(false);
    });
  }, [user]);

  // Which mode are we in?
  const sessionType = todaySession?.type ?? freeType;
  const showStrength = isStrengthType(sessionType) && (todaySession?.exercises.length ?? 0) > 0;
  const showCardio = isCardioType(sessionType);

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

      const hasExerciseLogs = showStrength && exerciseLogs.length > 0;

      const logData: Omit<WorkoutLog, "id" | "createdAt"> = {
        date: Timestamp.now(),
        ...(program?.id ? { programId: program.id } : {}),
        ...(todaySession ? { plannedSession: todaySession } : {}),
        actualDurationMin: durationMin,
        perceivedRPE: rpe,
        mood,
        energyLevel: energy,
        notes,
        ...(hasExerciseLogs ? { exerciseLogs } : {}),
        ...(finalCardio ? { cardioLog: finalCardio } : {}),
      };

      const docRef = await createLog(user.uid, user.uid, logData);

      // Fire-and-forget AI analysis
      fetch("/api/ai-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachId: user.uid,
          athleteId: user.uid,
          logId: docRef.id,
          plannedSession: todaySession,
          logData,
        }),
      });

      router.push(`/log/feedback/${docRef.id}`);
    } catch {
      setError("Errore nel salvataggio. Riprova.");
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">Log allenamento</h1>
        {todaySession ? (
          <p className="text-sm text-slate-400 mt-0.5">
            📅 <span className="text-white font-medium">{todaySession.title || SESSION_TYPE_LABELS[todaySession.type]}</span>
            {" · "}{SESSION_TYPE_LABELS[todaySession.type]}
          </p>
        ) : (
          <p className="text-sm text-slate-400 mt-0.5">Sessione libera</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Free session type toggle ── */}
        {!todaySession && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <p className={labelCls}>Tipo di allenamento</p>
            <div className="flex gap-2">
              {(["strength", "cardio"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFreeType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    freeType === t ? "bg-primary text-white" : "bg-slate-700 text-slate-300"
                  }`}
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
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Esercizi</p>
            {exerciseLogs.map((ex, i) => (
              <div key={i} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                {/* Exercise header */}
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{ex.name}</span>
                  <span className="text-xs text-slate-500">
                    prev. {ex.plannedSets}×{ex.plannedReps}
                    {ex.plannedLoad ? ` @ ${ex.plannedLoad}` : ""}
                  </span>
                </div>

                <div className="px-4 py-3 space-y-3">
                  {/* Actual metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Serie effettive">
                      <input
                        type="number" min={0}
                        value={ex.actualSets ?? ""}
                        onChange={(e) => updateExLog(i, { actualSets: e.target.value ? +e.target.value : undefined })}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Reps">
                      <input
                        value={ex.actualReps ?? ""}
                        onChange={(e) => updateExLog(i, { actualReps: e.target.value })}
                        placeholder="es. 8,7,7"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Carico">
                      <input
                        value={ex.actualLoad ?? ""}
                        onChange={(e) => updateExLog(i, { actualLoad: e.target.value })}
                        placeholder="es. 80kg"
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  {/* RPE per exercise */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls + " mb-0"}>RPE esercizio</label>
                      <span className="text-sm font-bold text-primary">{ex.rpe ?? "—"}</span>
                    </div>
                    <input
                      type="range" min={1} max={10} step={1}
                      value={ex.rpe ?? 5}
                      onChange={(e) => updateExLog(i, { rpe: +e.target.value })}
                      onMouseDown={() => { if (!ex.rpe) updateExLog(i, { rpe: 5 }); }}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600 -mt-0.5">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => <span key={n}>{n}</span>)}
                    </div>
                  </div>

                  {/* Exercise notes */}
                  <div>
                    <label className={labelCls}>Note (opzionale)</label>
                    <input
                      value={ex.notes ?? ""}
                      onChange={(e) => updateExLog(i, { notes: e.target.value })}
                      placeholder="Difficoltà, sensazioni, tecnica…"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Cardio metrics ── */}
        {showCardio && (
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Metriche cardio</p>

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
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-1 py-2 text-sm text-white text-center placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Duration ── */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-white">Durata effettiva</label>
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
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-white">
              RPE percepito globale
              {todaySession && (
                <span className="text-xs text-slate-400 font-normal ml-2">(target: {todaySession.targetRPE})</span>
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

        {/* ── Energy ── */}
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

        {/* ── Notes ── */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <label className="text-sm font-semibold text-white block mb-2">Note generali</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Come ti sei sentito? Difficoltà, PR, osservazioni…"
            className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary hover:bg-primary-600 disabled:opacity-60 text-white font-bold py-4 rounded-2xl text-base transition-colors"
        >
          {saving ? "Salvataggio…" : "Salva e analizza con AI ✨"}
        </button>
      </form>
    </div>
  );
}
