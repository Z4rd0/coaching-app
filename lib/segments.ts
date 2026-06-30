/**
 * Read adapter for the composable workout model (see /MIGRATION_SEGMENTS.md §4).
 *
 * `normalizeSession` is the SINGLE point through which the new UI reads a
 * workout: if a session already carries `segments` it returns them as-is;
 * otherwise it synthesizes them from the legacy fields. This is migration
 * STEP 2 — a pure read projection: it writes nothing, mutates nothing, and is
 * deterministic (stable segment ids, no randomness/clock), so it is trivially
 * testable and safe to call anywhere.
 */
import type {
  Session,
  Segment,
  StrengthSegment,
  EnduranceSegment,
  ConditioningSegment,
  NoteSegment,
  ExerciseGroup,
  MovementItem,
  Exercise,
  HiitBlock,
  HiitFormat,
  SegmentBase,
  Cycle,
} from "@/types";

type ConditioningStructure = ConditioningSegment["structure"];

// Legacy sessions are mono-type, so exactly one segment is synthesized; this is
// its stable id. (Authored multi-segment sessions bring their own ids.)
const SEG_ID = "seg-0";

const HIIT_STRUCTURES = new Set<HiitFormat>([
  "interval",
  "tabata",
  "emom",
  "amrap",
  "for_time",
]);

function hiitStructure(format?: HiitFormat): ConditioningStructure {
  return format && HIIT_STRUCTURES.has(format) ? format : "interval";
}

/** Every legacy exercise becomes a singleton group (uniform strength model). */
function exercisesToGroups(exercises?: Exercise[]): ExerciseGroup[] {
  return (exercises ?? []).map((ex) => ({ items: [ex] }));
}

function exercisesToMovements(exercises?: Exercise[]): MovementItem[] {
  return (exercises ?? []).map((ex) => ({
    name: ex.name,
    ...(ex.reps ? { reps: ex.reps } : {}),
    ...(ex.load ? { load: ex.load } : {}),
    ...(ex.restSeconds != null ? { restSeconds: ex.restSeconds } : {}),
  }));
}

/** Flatten HIIT blocks into movements; rest intervals carry restSeconds. */
function hiitBlocksToMovements(blocks?: HiitBlock[]): MovementItem[] {
  return (blocks ?? []).flatMap((block) =>
    block.intervals.map((iv) => ({
      name: iv.label,
      ...(iv.isRest
        ? { restSeconds: iv.durationSeconds }
        : { durationSec: iv.durationSeconds }),
    }))
  );
}

function note(base: SegmentBase): NoteSegment {
  return { ...base, kind: "note" };
}

function strength(base: SegmentBase, exercises?: Exercise[]): StrengthSegment {
  return { ...base, kind: "strength", groups: exercisesToGroups(exercises) };
}

export function normalizeSession(session: Session): Segment[] {
  // Authored segments win — never re-derive when they exist.
  if (session.segments && session.segments.length > 0) return session.segments;

  const base: SegmentBase = {
    id: SEG_ID,
    kind: "note", // overwritten by each constructor below
    ...(session.title ? { title: session.title } : {}),
    ...(session.notes ? { notes: session.notes } : {}),
  };

  switch (session.type) {
    case "strength":
      return [strength(base, session.exercises)];

    case "mobility":
      return [strength({ ...base, purpose: "mobility" }, session.exercises)];

    case "other":
      return session.exercises?.length
        ? [strength(base, session.exercises)]
        : [note(base)];

    case "cardio": {
      const seg: EnduranceSegment = {
        ...base,
        kind: "endurance",
        format: session.cardioFormat ?? "continuous",
        steps: session.intervals ?? [],
      };
      return [seg];
    }

    case "circuit": {
      const movements = exercisesToMovements(session.exercises);
      // Approximate "rest between rounds" as rest after the round's last movement.
      if (session.restBetweenRoundsSeconds != null && movements.length > 0) {
        movements[movements.length - 1] = {
          ...movements[movements.length - 1],
          restSeconds: session.restBetweenRoundsSeconds,
        };
      }
      const seg: ConditioningSegment = {
        ...base,
        kind: "conditioning",
        structure: "rounds",
        ...(session.targetRounds != null ? { rounds: session.targetRounds } : {}),
        movements,
      };
      return [seg];
    }

    case "hiit": {
      const blocks = session.hiitBlocks;
      const movements = blocks?.length
        ? hiitBlocksToMovements(blocks)
        : exercisesToMovements(session.exercises);
      const seg: ConditioningSegment = {
        ...base,
        kind: "conditioning",
        structure: hiitStructure(session.hiitFormat),
        ...(session.hiitTotalSeconds != null ? { timeCapSec: session.hiitTotalSeconds } : {}),
        // A single block maps cleanly to the segment's rounds.
        ...(blocks?.length === 1 ? { rounds: blocks[0].rounds } : {}),
        movements,
      };
      return [seg];
    }

    case "rest":
      return [{ ...base, kind: "rest" }];

    default:
      // Unknown/malformed type — never throw in a read path.
      return [note(base)];
  }
}

// ─── Write side (dual-write — MIGRATION_SEGMENTS.md §5.1) ──────────────────────

/**
 * Single, atomic projection applied at write time: persist the composable
 * `segments` ALONGSIDE the legacy fields, in one object, so the document always
 * carries both representations and un-upgraded clients keep reading the legacy
 * shape. While authoring is still legacy-first, `segments` is derived from the
 * legacy fields via normalizeSession(). (The reverse projection segments→legacy
 * lands with the segment-native builder.) Pure: no I/O, no mutation.
 */
export function serializeSessionForWrite(session: Session): Session {
  return { ...session, segments: normalizeSession(session) };
}

/**
 * Apply serializeSessionForWrite to every session in a program-shaped payload
 * (full or partial), in one pass, so the whole document is written with both
 * representations atomically. No-op when the payload carries no cycles.
 */
export function serializeProgramForWrite<T extends { cycles?: Cycle[] }>(data: T): T {
  if (!data.cycles) return data;
  return {
    ...data,
    cycles: data.cycles.map((cycle) => ({
      ...cycle,
      weeks: cycle.weeks.map((week) => ({
        ...week,
        sessions: week.sessions.map(serializeSessionForWrite),
      })),
    })),
  };
}
