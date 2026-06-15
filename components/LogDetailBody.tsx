"use client";

import type { WorkoutLog } from "@/types";
import { MOOD_LABELS, ENERGY_LABELS } from "@/types";

const ZONE_COLOR = ["bg-blue-500", "bg-green-500", "bg-yellow-400", "bg-orange-400", "bg-red-500"];
const ZONE_LABEL = ["Z1 Recupero", "Z2 Aerobica", "Z3 Soglia", "Z4 Anaerobica", "Z5 Massimale"];

/**
 * Renders everything under the log detail header: stats row, exercises,
 * cardio/circuit/HIIT panels, notes, and the coach comment.
 *
 * Used by both /history/[id] (coach) and /athlete/history/[id] — keeping the
 * markup here avoids two long files going out of sync (e.g. the previous
 * coach page never showed the HIIT log).
 */
export default function LogDetailBody({
  log,
  hideCoachComment = false,
}: {
  log: WorkoutLog;
  /** Coach view renders its own editable feedback box, so it hides the read-only one here. */
  hideCoachComment?: boolean;
}) {
  const zones = log.cardioLog?.hrZoneMinutes;
  const totalZoneMin = zones ? Object.values(zones).reduce((s, v) => s + (v ?? 0), 0) : 0;

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="Durata" value={`${log.actualDurationMin}m`} />
        <Stat label="RPE" value={`${log.perceivedRPE}/10`} />
        <Stat label="Umore" value={MOOD_LABELS[log.mood]} />
        <Stat label="Energia" value={ENERGY_LABELS[log.energyLevel]} />
      </div>

      {/* Coach comment */}
      {!hideCoachComment && log.coachComment && (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl px-4 py-3">
          <p className="text-xs text-primary font-medium mb-1">💬 Dal tuo coach</p>
          <p className="text-sm text-slate-200">{log.coachComment}</p>
        </div>
      )}

      {/* Exercise logs */}
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
                  {ex.notes && <p className="text-xs text-slate-500 mt-2 italic border-t border-slate-700/50 pt-2">{ex.notes}</p>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Cardio log */}
      {log.cardioLog && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Metriche cardio</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {log.cardioLog.avgHeartRate && <MetricRow icon="❤️" label="FC media" value={`${log.cardioLog.avgHeartRate} bpm`} />}
            {log.cardioLog.maxHeartRate && <MetricRow icon="🔺" label="FC max" value={`${log.cardioLog.maxHeartRate} bpm`} />}
            {log.cardioLog.distanceMeters && <MetricRow icon="📍" label="Distanza" value={`${(log.cardioLog.distanceMeters / 1000).toFixed(2)} km`} />}
            {log.cardioLog.avgPaceMinPerKm && <MetricRow icon="⏱" label="Passo medio" value={`${log.cardioLog.avgPaceMinPerKm} /km`} />}
            {log.cardioLog.calories && <MetricRow icon="🔥" label="Calorie" value={`${log.cardioLog.calories} kcal`} />}
          </div>
          {zones && totalZoneMin > 0 && <ZoneBar zones={zones} total={totalZoneMin} />}
        </div>
      )}

      {/* Circuit log */}
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
            return total > 0 ? <ZoneBar zones={z} total={total} /> : null;
          })()}
        </div>
      )}

      {/* HIIT log */}
      {log.hiitLog && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-rose-500/30 space-y-4">
          <p className="text-xs font-semibold text-rose-400 uppercase tracking-wider">HIIT</p>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-[10px] text-slate-500">Round completati</p>
              <p className="text-xl font-bold text-white">{log.hiitLog.roundsCompleted}</p>
            </div>
            {log.hiitLog.totalTimeSeconds != null && (
              <div>
                <p className="text-[10px] text-slate-500">Tempo totale</p>
                <p className="text-xl font-bold text-white">
                  {String(Math.floor(log.hiitLog.totalTimeSeconds / 60)).padStart(2, "0")}:
                  {String(log.hiitLog.totalTimeSeconds % 60).padStart(2, "0")}
                </p>
              </div>
            )}
          </div>
          {(log.hiitLog.avgHeartRate || log.hiitLog.maxHeartRate || log.hiitLog.calories) && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {log.hiitLog.avgHeartRate && <MetricRow icon="❤️" label="FC media" value={`${log.hiitLog.avgHeartRate} bpm`} />}
              {log.hiitLog.maxHeartRate && <MetricRow icon="🔺" label="FC max" value={`${log.hiitLog.maxHeartRate} bpm`} />}
              {log.hiitLog.calories && <MetricRow icon="🔥" label="Calorie" value={`${log.hiitLog.calories} kcal`} />}
            </div>
          )}
        </div>
      )}

      {/* Laps */}
      {log.laps && log.laps.length > 0 && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Lap / Ripetute
            </p>
            <span className="text-xs text-slate-500">{log.laps.length} lap</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="px-4 py-2 text-left font-medium text-slate-500">#</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-500">Dist.</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-500">Tempo</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-500">Passo</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-500">FC media</th>
                  <th className="px-2 py-2 text-right font-medium text-slate-500">FC max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {log.laps.map((lap) => {
                  const isFast = log.laps!.length > 2 && lap.avgPaceMinPerKm
                    ? lap.avgPaceMinPerKm === [...log.laps!]
                        .filter(l => l.avgPaceMinPerKm)
                        .sort((a, b) => a.avgPaceMinPerKm!.localeCompare(b.avgPaceMinPerKm!))[0]?.avgPaceMinPerKm
                    : false;
                  return (
                    <tr key={lap.index} className={isFast ? "bg-primary/5" : ""}>
                      <td className="px-4 py-2.5 text-slate-400 font-medium">{lap.index}</td>
                      <td className="px-2 py-2.5 text-right text-white">
                        {lap.distanceM >= 1000
                          ? `${(lap.distanceM / 1000).toFixed(2)} km`
                          : `${lap.distanceM} m`}
                      </td>
                      <td className="px-2 py-2.5 text-right text-white font-medium tabular-nums">
                        {`${String(Math.floor(lap.elapsedSec / 60)).padStart(2,"0")}:${String(lap.elapsedSec % 60).padStart(2,"0")}`}
                      </td>
                      <td className={`px-2 py-2.5 text-right font-medium tabular-nums ${isFast ? "text-primary" : "text-slate-300"}`}>
                        {lap.avgPaceMinPerKm ? `${lap.avgPaceMinPerKm}/km` : "—"}
                      </td>
                      <td className="px-2 py-2.5 text-right text-slate-300 tabular-nums">
                        {lap.avgHR ? `${lap.avgHR}` : "—"}
                      </td>
                      <td className="px-2 py-2.5 text-right text-slate-500 tabular-nums">
                        {lap.maxHR ? `${lap.maxHR}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Best lap highlight */}
          {(() => {
            const withPace = log.laps.filter(l => l.avgPaceMinPerKm);
            if (withPace.length < 2) return null;
            const best = [...withPace].sort((a, b) => a.avgPaceMinPerKm!.localeCompare(b.avgPaceMinPerKm!))[0];
            return (
              <div className="px-4 py-2 border-t border-slate-700/60">
                <p className="text-xs text-slate-500">
                  🏅 Lap più veloce: <span className="text-primary font-semibold">#{best.index} · {best.avgPaceMinPerKm}/km</span>
                  {best.avgHR ? <span className="text-slate-500 ml-2">· FC {best.avgHR} bpm</span> : null}
                </p>
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

function ZoneBar({ zones, total }: { zones: Record<string, number | undefined>; total: number }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">Zone cardiache · {total} min totali</p>
      <div className="flex rounded-lg overflow-hidden h-3 mb-2">
        {(["z1", "z2", "z3", "z4", "z5"] as const).map((z, idx) => {
          const min = zones[z] ?? 0;
          if (!min) return null;
          return <div key={z} className={`${ZONE_COLOR[idx]} h-full`} style={{ width: `${(min / total) * 100}%` }} />;
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {(["z1", "z2", "z3", "z4", "z5"] as const).map((z, idx) => {
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
  );
}
