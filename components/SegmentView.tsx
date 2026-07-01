import type { Segment, ExerciseGroup, MovementItem } from "@/types";
import CardioIntervals from "@/components/CardioIntervals";

/**
 * Read-only renderer for the composable workout model (MIGRATION_SEGMENTS.md).
 * Presentational only — feed it `normalizeSession(session)`. Used to display
 * heterogeneous (hybrid) sessions that the legacy per-type views can't express.
 */

const STRUCTURE_LABEL: Record<string, string> = {
  amrap: "AMRAP",
  emom: "EMOM",
  for_time: "For Time",
  rounds: "A round",
  tabata: "Tabata",
  interval: "Intervalli",
};

const PURPOSE_LABEL: Record<string, string> = {
  warmup: "Riscaldamento",
  main: "",
  cooldown: "Defaticamento",
  mobility: "Mobilità",
  accessory: "Accessori",
};

function fmtSec(sec?: number): string | null {
  if (sec == null) return null;
  return sec >= 60
    ? `${Math.floor(sec / 60)}m${sec % 60 ? (sec % 60) + "s" : ""}`
    : `${sec}s`;
}

function MovementRow({ m, index }: { m: MovementItem; index: number }) {
  const load = m.load;
  const metric =
    m.reps ??
    (m.distanceM != null
      ? `${m.distanceM} m`
      : m.durationSec != null
        ? fmtSec(m.durationSec)
        : m.calories != null
          ? `${m.calories} cal`
          : null);
  return (
    <li className="text-xs flex gap-2 items-baseline">
      <span className="text-slate-600 shrink-0 w-4 text-right">{index + 1}.</span>
      <span className="font-medium text-slate-200">{m.name}</span>
      {metric && <span className="text-slate-500">{metric}</span>}
      {load && <span className="text-slate-500">@ {load}</span>}
      {m.restSeconds != null && (
        <span className="text-slate-600 ml-auto">{fmtSec(m.restSeconds)} rec</span>
      )}
    </li>
  );
}

function StrengthGroup({ group, gi }: { group: ExerciseGroup; gi: number }) {
  const isSuperset = !!group.label && group.items.length > 1;
  return (
    <div className={isSuperset ? "rounded-lg bg-slate-800/40 p-2 space-y-1" : ""}>
      {isSuperset && (
        <div className="flex gap-2 text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300">Superset {group.label}</span>
          {group.rounds != null && <span>· {group.rounds} round</span>}
          {group.restSecondsAfter != null && <span>· {fmtSec(group.restSecondsAfter)} rec</span>}
        </div>
      )}
      <ul className="space-y-1">
        {group.items.map((ex, ei) => (
          <li key={ei} className="text-xs flex gap-2 items-baseline">
            <span className="text-slate-600 shrink-0 w-6 text-right">
              {group.label ? `${group.label}${ei + 1}` : `${gi + 1}.`}
            </span>
            <span className="font-medium text-slate-200">{ex.name}</span>
            <span className="text-slate-500">
              {ex.sets}×{ex.reps}
            </span>
            {ex.load && <span className="text-slate-500">@ {ex.load}</span>}
            {ex.restSeconds != null && !isSuperset && (
              <span className="text-slate-600 ml-auto">{fmtSec(ex.restSeconds)} rec</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SegmentBlock({ seg }: { seg: Segment }) {
  const purpose = seg.purpose ? PURPOSE_LABEL[seg.purpose] : "";
  const header = (
    <div className="flex items-baseline gap-2">
      {seg.title && <span className="text-xs font-semibold text-slate-200">{seg.title}</span>}
      {purpose && (
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{purpose}</span>
      )}
    </div>
  );

  return (
    <div className="border-t border-slate-700/40 pt-3 space-y-2">
      {header}

      {seg.kind === "strength" && (
        <div className="space-y-2">
          {seg.groups.map((g, gi) => (
            <StrengthGroup key={gi} group={g} gi={gi} />
          ))}
        </div>
      )}

      {seg.kind === "endurance" && (
        <div>
          <div className="text-[11px] text-slate-500 mb-1 capitalize">{seg.format}</div>
          {seg.steps.length > 0 && <CardioIntervals intervals={seg.steps} />}
        </div>
      )}

      {seg.kind === "conditioning" && (
        <div className="space-y-1">
          <div className="flex gap-3 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300">
              {STRUCTURE_LABEL[seg.structure] ?? seg.structure}
            </span>
            {seg.rounds != null && <span>🔄 {seg.rounds} round</span>}
            {seg.timeCapSec != null && <span>⏱ {fmtSec(seg.timeCapSec)}</span>}
          </div>
          <ul className="space-y-1">
            {seg.movements.map((m, mi) => (
              <MovementRow key={mi} m={m} index={mi} />
            ))}
          </ul>
        </div>
      )}

      {seg.kind === "rest" && (
        <div className="text-xs text-slate-500">
          Riposo{seg.durationSec != null ? ` · ${fmtSec(seg.durationSec)}` : ""}
        </div>
      )}

      {seg.notes && <p className="text-xs text-slate-500 italic">{seg.notes}</p>}
    </div>
  );
}

export default function SegmentView({ segments }: { segments: Segment[] }) {
  return (
    <div className="space-y-1">
      {segments.map((seg, i) => (
        <SegmentBlock key={seg.id || i} seg={seg} />
      ))}
    </div>
  );
}
