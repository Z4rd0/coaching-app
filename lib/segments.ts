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

/** The legacy session fields the reverse projection can populate. */
type LegacySessionFields = Partial<
  Pick<
    Session,
    | "type"
    | "exercises"
    | "cardioFormat"
    | "intervals"
    | "targetRounds"
    | "restBetweenRoundsSeconds"
    | "hiitFormat"
    | "hiitBlocks"
    | "hiitTotalSeconds"
  >
>;

/** Best-effort projection of a conditioning movement back to a legacy Exercise —
 *  distance/duration/calories are folded into `reps` so old clients still see them. */
function movementToExercise(m: MovementItem): Exercise {
  const reps =
    m.reps ??
    (m.distanceM != null
      ? `${m.distanceM} m`
      : m.durationSec != null
        ? `${m.durationSec} s`
        : m.calories != null
          ? `${m.calories} cal`
          : "");
  return {
    name: m.name,
    sets: 1,
    reps,
    load: m.load ?? "",
    notes: "",
    ...(m.restSeconds != null ? { restSeconds: m.restSeconds } : {}),
  };
}

/** Flatten groups to a legacy exercise list — old clients lose the A1/A2 grouping. */
function groupsToExercises(groups: ExerciseGroup[]): Exercise[] {
  return groups.flatMap((g) => g.items);
}

/**
 * Reverse projection (segments → legacy fields), used when authoring is
 * segment-native so un-upgraded clients still get a usable legacy shape. Faithful
 * for single-segment sessions; for a true hybrid (heterogeneous segments) legacy
 * can't be exact, so it falls back to type "other" with the movements flattened —
 * new clients read `segments` (authoritative). Pure.
 */
export function denormalizeSegments(segments: Segment[]): LegacySessionFields {
  if (segments.length === 1) {
    const seg = segments[0];
    switch (seg.kind) {
      case "strength":
        return { type: "strength", exercises: groupsToExercises(seg.groups) };
      case "endurance":
        return { type: "cardio", cardioFormat: seg.format, intervals: seg.steps };
      case "conditioning":
        if (seg.structure === "rounds") {
          return {
            type: "circuit",
            ...(seg.rounds != null ? { targetRounds: seg.rounds } : {}),
            exercises: seg.movements.map(movementToExercise),
          };
        }
        return {
          type: "hiit",
          hiitFormat: seg.structure, // amrap|emom|for_time|tabata|interval ⊂ HiitFormat
          ...(seg.timeCapSec != null ? { hiitTotalSeconds: seg.timeCapSec } : {}),
          hiitBlocks: [
            {
              rounds: seg.rounds ?? 1,
              intervals: seg.movements.map((m) => ({
                label: m.name,
                durationSeconds: m.durationSec ?? m.restSeconds ?? 0,
                isRest: m.restSeconds != null && m.durationSec == null,
              })),
            },
          ],
        };
      case "rest":
        return { type: "rest" };
      case "note":
        return { type: "other" };
    }
  }
  // Heterogeneous (true hybrid) — best-effort fallback for old clients.
  const exercises = segments.flatMap((seg) =>
    seg.kind === "strength"
      ? groupsToExercises(seg.groups)
      : seg.kind === "conditioning"
        ? seg.movements.map(movementToExercise)
        : []
  );
  return { type: "other", exercises };
}

/**
 * Single, atomic projection applied at write time: persist the composable
 * `segments` ALONGSIDE the legacy fields, in one object, so the document always
 * carries both representations and un-upgraded clients keep reading the legacy
 * shape.
 *
 * `sourceOfTruth` declares which side the caller authored:
 *  - "legacy" (default): legacy-first writers (current builder, MCP, import,
 *    copy) — `segments` is derived from the legacy fields via normalizeSession().
 *  - "segments": segment-native writers (the new builder) — the legacy fields are
 *    derived from `segments` via denormalizeSegments().
 *
 * Pure: no I/O, no mutation.
 */
export function serializeSessionForWrite(
  session: Session,
  sourceOfTruth: "legacy" | "segments" = "legacy"
): Session {
  if (sourceOfTruth === "segments" && session.segments?.length) {
    return { ...session, ...denormalizeSegments(session.segments), segments: session.segments };
  }
  return { ...session, segments: normalizeSession(session) };
}

/**
 * Apply serializeSessionForWrite to every session in a program-shaped payload
 * (full or partial), in one pass, so the whole document is written with both
 * representations atomically. No-op when the payload carries no cycles.
 */
export function serializeProgramForWrite<T extends { cycles?: Cycle[] }>(
  data: T,
  sourceOfTruth: "legacy" | "segments" = "legacy"
): T {
  if (!data.cycles) return data;
  return {
    ...data,
    cycles: data.cycles.map((cycle) => ({
      ...cycle,
      weeks: cycle.weeks.map((week) => ({
        ...week,
        sessions: week.sessions.map((s) => serializeSessionForWrite(s, sourceOfTruth)),
      })),
    })),
  };
}
