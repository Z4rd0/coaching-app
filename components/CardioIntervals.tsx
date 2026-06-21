import type { CardioInterval, CardioIntervalStep } from "@/types";

function fmtDist(m?: number): string | null {
  if (!m) return null;
  return m >= 1000 && m % 100 === 0 ? `${m / 1000} km` : `${m} m`;
}

function fmtTime(s?: number): string | null {
  if (!s) return null;
  if (s < 60) return `${s}"`;
  if (s % 60 === 0) return `${s / 60}'`;
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}"`;
}

/** Render a work/recovery step as e.g. "1 km @ 4:00/km · FC Z4" */
function fmtStep(step?: CardioIntervalStep): string {
  if (!step) return "";
  const measure = [fmtDist(step.distanceM), fmtTime(step.durationSec)].filter(Boolean).join(" / ");
  let out = measure || "—";
  if (step.targetPace) out += ` @ ${step.targetPace}`;
  if (step.targetHR) out += ` · FC ${step.targetHR}`;
  return out;
}

const REC_KIND: Record<string, string> = { jog: "corsa lenta", walk: "camminata", stand: "fermo" };

/** Read-only display of a cardio session's structured interval prescription. */
export default function CardioIntervals({ intervals }: { intervals?: CardioInterval[] }) {
  if (!intervals || intervals.length === 0) return null;
  return (
    <div className="space-y-2">
      {intervals.map((iv, i) => {
        const rec = iv.recovery ? fmtStep(iv.recovery) : "";
        return (
          <div key={i} className="bg-slate-800 rounded-xl px-3 py-2.5">
            <p className="text-white text-sm font-medium">
              {iv.label ? `${iv.label} · ` : ""}
              {iv.reps > 1 ? `${iv.reps}× ` : ""}
              {fmtStep(iv.work)}
            </p>
            {iv.recovery && rec && (
              <p className="text-xs text-slate-400 mt-0.5">
                Recupero: {rec}
                {iv.recovery.kind ? ` (${REC_KIND[iv.recovery.kind] ?? iv.recovery.kind})` : ""}
              </p>
            )}
            {iv.notes && <p className="text-xs text-slate-500 mt-1">{iv.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}
