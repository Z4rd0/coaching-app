import type { Segment, Session } from "@/types";
import { normalizeSession } from "@/lib/segments";
import { sessionMeta } from "@/lib/sessionMeta";

/**
 * The shape of a workout at a glance: a bar per step, height = intensity,
 * width = share of the total duration.
 *
 * Reading "5×1000m @4:00 con 2' rec" tells you what to do; it does not tell you
 * what the session *is* until you've parsed it. A profile does that in one look
 * — which is why every endurance platform draws one. Pure SVG, no dependency,
 * and it reads from the composable segments we already store.
 */

interface Bar {
  /** 0-1, relative intensity → bar height. */
  intensity: number;
  /** Relative width (arbitrary units, normalized at render). */
  weight: number;
  /** Rest bars are drawn muted. */
  rest: boolean;
}

/** Rough intensity for a strength set — heavier/lower reps read as harder. */
function repsIntensity(reps?: string): number {
  const n = parseInt((reps ?? "").replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return 0.6;
  if (n <= 3) return 0.95;
  if (n <= 6) return 0.85;
  if (n <= 10) return 0.7;
  if (n <= 15) return 0.55;
  return 0.45;
}

function segmentBars(seg: Segment): Bar[] {
  switch (seg.kind) {
    case "strength":
      return seg.groups.flatMap((g) =>
        g.items.map((ex) => ({
          intensity: repsIntensity(ex.reps),
          weight: Math.max(1, ex.sets || 1),
          rest: false,
        }))
      );

    case "endurance":
      // Each repeat contributes a work bar and, when prescribed, a recovery bar.
      return seg.steps.flatMap((step) => {
        const reps = Math.max(1, step.reps || 1);
        const workWeight = step.work.distanceM
          ? step.work.distanceM / 200
          : (step.work.durationSec ?? 60) / 60;
        const bars: Bar[] = [];
        for (let i = 0; i < reps; i++) {
          bars.push({ intensity: 0.85, weight: Math.max(0.5, workWeight), rest: false });
          if (step.recovery) {
            const recWeight = step.recovery.distanceM
              ? step.recovery.distanceM / 200
              : (step.recovery.durationSec ?? 60) / 60;
            bars.push({ intensity: 0.3, weight: Math.max(0.5, recWeight), rest: true });
          }
        }
        return bars;
      });

    case "conditioning": {
      const rounds = Math.max(1, seg.rounds ?? 1);
      const per = seg.movements.length || 1;
      return Array.from({ length: Math.min(rounds * per, 40) }, () => ({
        intensity: 0.9,
        weight: 1,
        rest: false,
      }));
    }

    case "rest":
      return [{ intensity: 0.15, weight: Math.max(1, (seg.durationSec ?? 120) / 60), rest: true }];

    default:
      return [];
  }
}

export default function SessionProfile({
  session,
  height = 28,
  className = "",
}: {
  session: Session;
  height?: number;
  className?: string;
}) {
  const bars = normalizeSession(session).flatMap(segmentBars);
  // Nothing meaningful to draw: a single bar would just be a coloured block.
  if (bars.length < 2) return null;

  const total = bars.reduce((s, b) => s + b.weight, 0);
  if (total <= 0) return null;

  const color = sessionMeta(session.type).color;
  const W = 100;
  const gap = bars.length > 40 ? 0 : 0.6;

  let x = 0;
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className={`w-full ${className}`}
      style={{ height }}
      role="img"
      aria-label="Profilo della sessione"
    >
      {bars.map((b, i) => {
        const w = (b.weight / total) * W;
        const h = Math.max(2, b.intensity * height);
        const rect = (
          <rect
            key={i}
            x={x}
            y={height - h}
            width={Math.max(0.5, w - gap)}
            height={h}
            rx={0.8}
            fill={color}
            opacity={b.rest ? 0.25 : 0.85}
          />
        );
        x += w;
        return rect;
      })}
    </svg>
  );
}
