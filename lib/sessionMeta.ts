import type { SessionType } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";

/**
 * The single source of truth for how a session type looks.
 *
 * There used to be four partial colour maps (ProgramBuilder, calendar, athlete
 * program, coach dashboard), each missing different types and disagreeing on
 * the ones they shared: a hybrid session was grey in one page and absent from
 * another, mobility was purple in three places and green in the fourth, and the
 * dashboard painted cardio (#FBBF24) and circuit (#FACC15) two near-identical
 * yellows — unreadable side by side.
 *
 * Two representations are provided because the pages style differently:
 * `dot`/`badge` are Tailwind classes (calendar, builder, athlete program) while
 * `color`/`tint` are raw values for the inline `style` used by the restyled
 * dashboard. They are the same colour, so the two never drift apart.
 */
export interface SessionTypeMeta {
  label: string;
  /** Emoji glyph — recognisable at 12px where an SVG icon set would not be,
   *  and it costs no bundle. Paired with `dot`/`badge`, never used alone. */
  icon: string;
  /** Tailwind background for the small colour dot / bar. */
  dot: string;
  /** Tailwind background+text for a pill badge. */
  badge: string;
  /** Hex, for inline styles. */
  color: string;
  /** Translucent version of `color`, for inline backgrounds. */
  tint: string;
}

export const SESSION_TYPE_META: Record<SessionType, SessionTypeMeta> = {
  strength: {
    label: SESSION_TYPE_LABELS.strength,
    icon: "🏋️",
    dot: "bg-blue-500",
    badge: "bg-blue-500/20 text-blue-300",
    color: "#60A5FA",
    tint: "rgba(59,130,246,0.12)",
  },
  cardio: {
    label: SESSION_TYPE_LABELS.cardio,
    icon: "🏃",
    dot: "bg-orange-400",
    badge: "bg-orange-400/20 text-orange-300",
    color: "#FB923C",
    tint: "rgba(251,146,60,0.12)",
  },
  circuit: {
    label: SESSION_TYPE_LABELS.circuit,
    icon: "🔁",
    dot: "bg-yellow-400",
    badge: "bg-yellow-400/20 text-yellow-300",
    color: "#FACC15",
    tint: "rgba(250,204,21,0.12)",
  },
  hiit: {
    label: SESSION_TYPE_LABELS.hiit,
    icon: "⚡",
    dot: "bg-rose-500",
    badge: "bg-rose-500/20 text-rose-300",
    color: "#FB7185",
    tint: "rgba(244,63,94,0.12)",
  },
  mobility: {
    label: SESSION_TYPE_LABELS.mobility,
    icon: "🧘",
    dot: "bg-purple-400",
    badge: "bg-purple-400/20 text-purple-300",
    color: "#A78BFA",
    tint: "rgba(167,139,250,0.12)",
  },
  hybrid: {
    label: SESSION_TYPE_LABELS.hybrid,
    icon: "🔀",
    dot: "bg-teal-400",
    badge: "bg-teal-400/20 text-teal-300",
    color: "#2DD4BF",
    tint: "rgba(45,212,191,0.12)",
  },
  rest: {
    label: SESSION_TYPE_LABELS.rest,
    icon: "😴",
    dot: "bg-slate-500",
    badge: "bg-slate-600/40 text-slate-400",
    color: "#94A3B8",
    tint: "rgba(148,163,184,0.12)",
  },
  other: {
    label: SESSION_TYPE_LABELS.other,
    icon: "•",
    dot: "bg-slate-400",
    badge: "bg-slate-600/40 text-slate-400",
    color: "#CBD5E1",
    tint: "rgba(203,213,225,0.12)",
  },
};

/** Meta for a session type, tolerant of legacy/unknown values from Firestore. */
export function sessionMeta(type: string): SessionTypeMeta {
  return SESSION_TYPE_META[type as SessionType] ?? SESSION_TYPE_META.other;
}
