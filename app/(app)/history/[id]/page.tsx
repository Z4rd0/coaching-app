"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getLog } from "@/lib/firestore";
import type { WorkoutLog } from "@/types";
import { MOOD_LABELS, ENERGY_LABELS, SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

// ─── Zone colours ─────────────────────────────────────────────────────────────
const ZONE_COLOR = ["bg-blue-500","bg-green-500","bg-yellow-400","bg-orange-400","bg-red-500"];
const ZONE_LABEL = ["Z1 Recupero","Z2 Aerobica","Z3 Soglia","Z4 Anaerobica","Z5 Massimale"];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LogDetailPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getLog(user.uid, user.uid, id).then((data) => {
      setLog(data);
      setLoading(false);
    });
  }, [user, id]);

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!log) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-slate-400">Log non trovato</p>
    </div>
  );

  const zones = log.cardioLog?.hrZoneMinutes;
  const totalZoneMin = zones
    ? Object.values(zones).reduce((s, v) => s + (v ?? 0), 0)
    : 0;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <p className="text-xs text-slate-400 capitalize">
            {format(log.date.toDate(), "EEEE d MMMM yyyy", { locale: it })}
          </p>
          <h1 className="text-xl font-bold text-white">
            {log.plannedSession?.title || "Sessione libera"}
          </h1>
          {log.plannedSession && (
            <span className="text-xs text-slate-400">{SESSION_TYPE_LABELS[log.plannedSession.type]}</span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Durata" value={`${log.actualDurationMin}m`} />
        <Stat label="RPE" value={`${log.perceivedRPE}/10`} />
        <Stat label="Umore" value={MOOD_LABELS[log.mood]} />
        <Stat label="Energia" value={ENERGY_LABELS[log.energyLevel]} />
      </div>

      {/* ── Exercise logs (Strength) ── */}
      {log.exerciseLogs && log.exerciseLogs.length > 0 && (
        <section className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Esercizi</p>
          {log.exerciseLogs.map((ex, i) => {
            const changed =
              ex.actualReps !== ex.plannedReps ||
              ex.actualLoad !== ex.plannedLoad ||
              ex.actualSets !== ex.plannedSets;
            return (
              <div key={i} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{ex.name}</span>
                  {ex.rpe !== undefined && (
                    <span className="text-xs bg-primary/20 text-primary-300 px-2 py-0.5 rounded-full font-medium">
                      RPE {ex.rpe}
                    </span>
                  )}
                </div>
                <div className="px-4 py-3">
                  {/* Planned vs actual */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Pianificato</p>
                      <p className="text-slate-400">
                        {ex.plannedSets}×{ex.plannedReps}
                        {ex.plannedLoad ? <span className="ml-1 text-slate-500">@ {ex.plannedLoad}</span> : null}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Effettivo</p>
                      <p className={changed ? "text-white font-medium" : "text-slate-400"}>
                        {ex.actualSets}×{ex.actualReps}
                        {ex.actualLoad ? <span className="ml-1 text-slate-400">@ {ex.actualLoad}</span> : null}
                      </p>
                    </div>
                  </div>
                  {ex.notes && (
                    <p className="text-xs text-slate-500 mt-2 italic border-t border-slate-700/50 pt-2">{ex.notes}</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ── Cardio log ── */}
      {log.cardioLog && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Metriche cardio</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {log.cardioLog.avgHeartRate && (
              <MetricRow icon="❤️" label="FC media" value={`${log.cardioLog.avgHeartRate} bpm`} />
            )}
            {log.cardioLog.maxHeartRate && (
              <MetricRow icon="🔺" label="FC max" value={`${log.cardioLog.maxHeartRate} bpm`} />
            )}
            {log.cardioLog.distanceMeters && (
              <MetricRow icon="📍" label="Distanza" value={`${(log.cardioLog.distanceMeters / 1000).toFixed(2)} km`} />
            )}
            {log.cardioLog.avgPaceMinPerKm && (
              <MetricRow icon="⏱" label="Passo medio" value={`${log.cardioLog.avgPaceMinPerKm} /km`} />
            )}
            {log.cardioLog.calories && (
              <MetricRow icon="🔥" label="Calorie" value={`${log.cardioLog.calories} kcal`} />
            )}
          </div>

          {/* HR zones bar */}
          {zones && totalZoneMin > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Zone cardiache · {totalZoneMin} min totali</p>
              {/* Stacked bar */}
              <div className="flex rounded-lg overflow-hidden h-3 mb-2">
                {(["z1","z2","z3","z4","z5"] as const).map((z, idx) => {
                  const min = zones[z] ?? 0;
                  if (!min || !totalZoneMin) return null;
                  const pct = (min / totalZoneMin) * 100;
                  return (
                    <div key={z} className={`${ZONE_COLOR[idx]} h-full`} style={{ width: `${pct}%` }} />
                  );
                })}
              </div>
              {/* Zone legend */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {(["z1","z2","z3","z4","z5"] as const).map((z, idx) => {
                  const min = zones[z];
                  if (!min) return null;
                  return (
                    <div key={z} className="flex items-center gap-1.5 text-xs text-slate-400">
                      <div className={`w-2 h-2 rounded-full ${ZONE_COLOR[idx]}`} />
                      <span>{ZONE_LABEL[idx]}</span>
                      <span className="ml-auto font-medium text-white">{min} min</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Circuit log ── */}
      {log.circuitLog && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-yellow-400/30 space-y-4">
          <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Circuit</p>

          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-[10px] text-slate-500">Round completati</p>
              <p className="text-xl font-bold text-white">{log.circuitLog.roundsCompleted}</p>
            </div>
            {log.circuitLog.restBetweenRoundsSeconds && (
              <div>
                <p className="text-[10px] text-slate-500">Recupero round</p>
                <p className="text-xl font-bold text-white">
                  {log.circuitLog.restBetweenRoundsSeconds >= 60
                    ? `${log.circuitLog.restBetweenRoundsSeconds / 60}m`
                    : `${log.circuitLog.restBetweenRoundsSeconds}s`}
                </p>
              </div>
            )}
          </div>

          {(log.circuitLog.avgHeartRate || log.circuitLog.maxHeartRate || log.circuitLog.calories) && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {log.circuitLog.avgHeartRate && <MetricRow icon="❤️" label="FC media" value={`${log.circuitLog.avgHeartRate} bpm`} />}
              {log.circuitLog.maxHeartRate && <MetricRow icon="🔺" label="FC max" value={`${log.circuitLog.maxHeartRate} bpm`} />}
              {log.circuitLog.calories && <MetricRow icon="🔥" label="Calorie" value={`${log.circuitLog.calories} kcal`} />}
            </div>
          )}

          {log.circuitLog.hrZoneMinutes && (() => {
            const z = log.circuitLog!.hrZoneMinutes!;
            const total = Object.values(z).reduce((s, v) => s + (v ?? 0), 0);
            if (!total) return null;
            return (
              <div>
                <p className="text-xs text-slate-500 mb-2">Zone cardiache · {total} min</p>
                <div className="flex rounded-lg overflow-hidden h-3 mb-2">
                  {(["z1","z2","z3","z4","z5"] as const).map((k, idx) => {
                    const min = z[k] ?? 0;
                    if (!min) return null;
                    return <div key={k} className={`${ZONE_COLOR[idx]} h-full`} style={{ width: `${(min / total) * 100}%` }} />;
                  })}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {(["z1","z2","z3","z4","z5"] as const).map((k, idx) => {
                    const min = z[k];
                    if (!min) return null;
                    return (
                      <div key={k} className="flex items-center gap-1.5 text-xs text-slate-400">
                        <div className={`w-2 h-2 rounded-full ${ZONE_COLOR[idx]}`} />
                        <span>{ZONE_LABEL[idx]}</span>
                        <span className="ml-auto font-medium text-white">{min} min</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Notes */}
      {log.notes && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <p className="text-xs font-semibold text-slate-400 mb-1">Note</p>
          <p className="text-sm text-slate-300">{log.notes}</p>
        </div>
      )}

    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-2 border border-slate-700 text-center">
      <p className="text-base font-bold text-white">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

function MetricRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <div>
        <p className="text-[10px] text-slate-500">{label}</p>
        <p className="text-sm font-medium text-white">{value}</p>
      </div>
    </div>
  );
}
