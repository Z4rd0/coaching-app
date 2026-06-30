import { Timestamp } from "firebase/firestore";

// ─── Coach ───────────────────────────────────────────────────────────────────

export interface Coach {
  id: string;
  name: string;
  email: string;
  createdAt: Timestamp;
  settings: Record<string, unknown>;
  /** Account lifecycle — "active" once onboarding is complete */
  status?: "active" | "pending_onboarding";
  /** Billing plan. "founder" = the owner's account: free & unlimited forever */
  plan?: "free" | "pro" | "founder";
  /** When true, bypasses all plan limits and billing (founder accounts).
   *  The Stripe webhook must never overwrite an exempt account. */
  exempt?: boolean;
  /** Optional coaching specialization, collected at onboarding */
  specialization?: string;
  onboardingCompletedAt?: Timestamp;
}

/** Max active athletes allowed on the free plan (enforced server-side) */
export const FREE_PLAN_ATHLETE_LIMIT = 5;

// ─── Athlete ──────────────────────────────────────────────────────────────────

export interface Athlete {
  id: string;
  name: string;
  email: string;
  sport: string;
  goals: string;
  notes: string;
  /** Firebase Auth UID of the athlete — set after they accept the invite */
  athleteUid?: string;
  status: "pending" | "invited" | "active" | "archived";
  createdAt: Timestamp;
}

/** Written to /athleteAccess/{athleteUid} — used by security rules */
export interface AthleteAccess {
  coachId: string;
  athleteId: string;
  name: string;
  email: string;
}

// ─── Invite ───────────────────────────────────────────────────────────────────

export interface Invite {
  id: string;
  athleteId: string;
  email: string;
  coachId: string;
  coachName: string;
  status: "pending" | "accepted" | "expired";
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

// ─── Program ──────────────────────────────────────────────────────────────────

export interface Exercise {
  name: string;
  sets: number;
  reps: string;         // e.g. "8-10" or "AMRAP"
  load: string;         // e.g. "70% 1RM" or "bodyweight"
  restSeconds?: number;
  variants?: string;    // e.g. "Se non hai bilanciere usa manubri"
  notes: string;
}

// ─── HIIT ─────────────────────────────────────────────────────────────────────

export interface HiitInterval {
  label: string;
  durationSeconds: number;
  isRest: boolean;
}

export interface HiitBlock {
  rounds: number;
  intervals: HiitInterval[];
}

export type HiitFormat = "interval" | "tabata" | "emom" | "amrap" | "for_time";

// ─── Cardio intervals (running / cycling / swim repeats) ───────────────────────

/** One effort or recovery segment — distance- or time-based, with optional
 *  target pace / heart rate. */
export interface CardioIntervalStep {
  distanceM?: number;    // e.g. 1000 for 1 km
  durationSec?: number;  // e.g. 180 for 3'
  targetPace?: string;   // e.g. "4:00/km", "1:45/100m"
  targetHR?: string;     // e.g. "Z4" or "165-170"
}

/** A repeated work/recovery pair, e.g. 5× (1000m @ 4:00/km, rec 2' jog). */
export interface CardioInterval {
  reps: number;                 // how many times the work/recovery pair repeats
  work: CardioIntervalStep;
  recovery?: CardioIntervalStep & { kind?: "jog" | "walk" | "stand" };
  label?: string;               // e.g. "Riscaldamento", "Serie principale"
  notes?: string;
}

export type CardioFormat =
  | "continuous"   // steady run (no intervals)
  | "intervals"    // structured repeats
  | "fartlek"
  | "tempo"
  | "progression";

export interface HiitLog {
  roundsCompleted: number;
  totalTimeSeconds?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
}

// ─── Composable segments (workout model — see /MIGRATION_SEGMENTS.md) ──────────
// A workout becomes an ordered sequence of heterogeneous segments so that
// strength, endurance and hybrid (Hyrox/metcon) all fit one model. STEP 1 of the
// migration: these are ADDITIVE — `Session.segments?` is optional and the legacy
// fields stay authoritative until the redesign's later steps. Nothing reads these
// yet; the read adapter `normalizeSession()` lands in step 2.

/** What role a segment plays in the session — orthogonal to its `kind`
 *  (a warmup can be strength, endurance or conditioning). */
export type SegmentPurpose = "warmup" | "main" | "cooldown" | "mobility" | "accessory";

export interface SegmentBase {
  /** Stable id within the session — referenced by SegmentLog (planned↔actual). */
  id: string;
  kind: string;
  title?: string;
  notes?: string;
  /** Defaults to "main" when absent. */
  purpose?: SegmentPurpose;
}

/** A strength block: one exercise (singleton group) or a superset / giant set
 *  (A1/A2…). The model is uniform — a normal exercise is a group of one item, so
 *  there is no parallel flat `exercises[]`. */
export interface ExerciseGroup {
  /** Shared label = superset, e.g. "A" → A1/A2. Absent for standalone exercises. */
  label?: string;
  /** Rounds of the whole group (superset repeated N times). Falls back to the
   *  items' own `sets` when absent. */
  rounds?: number;
  /** Rest after the complete group, in seconds (intra-group rest is per-item). */
  restSecondsAfter?: number;
  /** Exercises in execution order: items[0]=A1, items[1]=A2, … */
  items: Exercise[];
}

export interface StrengthSegment extends SegmentBase {
  kind: "strength";
  groups: ExerciseGroup[];
}

export interface EnduranceSegment extends SegmentBase {
  kind: "endurance";
  format: CardioFormat;
  steps: CardioInterval[];
}

/** One movement inside a conditioning block: strength-like (reps/load) OR
 *  endurance-like (distance/duration/calories). One type, optional fields. */
export interface MovementItem {
  name: string;
  reps?: string;       // "10", "AMRAP", "max"
  load?: string;       // "20 kg", "70% 1RM", "bodyweight"
  distanceM?: number;  // 1000 (run/row)
  durationSec?: number;
  calories?: number;   // erg by calories
  targetPace?: string;
  targetHR?: string;
  restSeconds?: number;
}

/** The hybrid block that the legacy model can't express: a timed structure that
 *  mixes strength and endurance movements (Hyrox / metcon / CrossFit-style). */
export interface ConditioningSegment extends SegmentBase {
  kind: "conditioning";
  structure: "amrap" | "emom" | "for_time" | "rounds" | "tabata" | "interval";
  timeCapSec?: number; // AMRAP / for-time
  rounds?: number;     // rounds / EMOM
  movements: MovementItem[];
}

export interface RestSegment extends SegmentBase {
  kind: "rest";
  durationSec?: number;
}

export interface NoteSegment extends SegmentBase {
  kind: "note";
}

export type Segment =
  | StrengthSegment
  | EnduranceSegment
  | ConditioningSegment
  | RestSegment
  | NoteSegment;

export type SegmentKind = Segment["kind"];

export interface Session {
  dayOfWeek: number; // 0 = Monday … 6 = Sunday
  /** Optional ISO date "YYYY-MM-DD" — when set, overrides dayOfWeek
   *  for scheduling. Lets the coach pin a session to a precise calendar day. */
  scheduledDate?: string;
  type: "strength" | "cardio" | "mobility" | "rest" | "other" | "circuit" | "hiit";
  title: string;
  exercises: Exercise[];
  targetRPE: number; // 1-10
  durationMin: number;
  notes: string;
  // Circuit-specific
  targetRounds?: number;
  restBetweenRoundsSeconds?: number;
  // HIIT-specific
  hiitFormat?: HiitFormat;
  hiitBlocks?: HiitBlock[];
  hiitTotalSeconds?: number;
  // Cardio-specific (running/cycling/swim) — structured interval prescription
  cardioFormat?: CardioFormat;
  intervals?: CardioInterval[];
  // ── Composable model (additive — see /MIGRATION_SEGMENTS.md) ──
  /** New source of truth: ordered heterogeneous segments. Optional during the
   *  migration; when absent, normalizeSession() synthesizes it from the legacy
   *  fields above. Read it only via normalizeSession()/repository, never raw. */
  segments?: Segment[];
}

export interface Week {
  weekNumber: number;
  sessions: Session[];
}

export interface Cycle {
  cycleNumber: number;
  weeks: Week[];
}

export interface Program {
  id: string;
  name: string;
  sport: string;
  cycles: Cycle[];
  createdAt: Timestamp;
  isActive?: boolean;
  startDate?: string; // ISO "YYYY-MM-DD" — Monday of week 1
}

/** A program that belongs to a specific athlete (personalized copy) */
export interface AthleteProgram {
  id: string;
  name: string;
  sport: string;
  cycles: Cycle[];
  createdAt: Timestamp;
  isActive?: boolean;
  startDate?: string;
  /** If copied from coach library, stores the source template id */
  sourceTemplateId?: string;
  status: "active" | "completed" | "paused";
}

// ─── Group ────────────────────────────────────────────────────────────────────

/** Training group: a set of athletes who share the same programs */
export interface Group {
  id: string;
  name: string;
  sport: string;
  description: string;
  /** Athlete profile ids (/coaches/{coachId}/athletes/{athleteId}) */
  memberIds: string[];
  /** Firebase Auth UIDs of active members — read by security rules to authorize member access */
  memberUids: string[];
  /** All-time per-member totals for the leaderboard — updated server-side
   *  by /api/group-feed on each shared log (avoids re-reading the whole feed) */
  stats?: Record<string, { name: string; sessions: number; minutes: number }>;
  createdAt: Timestamp;
}

/** Shared program in a group — single document, all members see live updates */
export type GroupProgram = AthleteProgram;

/** Fase 2 ("gara"): lightweight copy of a member's log, visible to the whole group */
export interface GroupFeedEntry {
  id: string;
  athleteId: string;
  athleteUid: string;
  athleteName: string;
  logId: string;
  date: Timestamp;
  sessionTitle?: string;
  sessionType?: Session["type"];
  actualDurationMin: number;
  perceivedRPE: number;
  createdAt: Timestamp;
}

// ─── Workout Log ──────────────────────────────────────────────────────────────

export interface ExerciseLog {
  name: string;
  plannedSets?: number;
  plannedReps?: string;
  plannedLoad?: string;
  actualSets?: number;
  actualReps?: string;
  actualLoad?: string;
  rpe?: number;
  notes?: string;
}

export interface CardioLog {
  avgHeartRate?: number;
  maxHeartRate?: number;
  distanceMeters?: number;
  avgPaceMinPerKm?: string;
  calories?: number;
  hrZoneMinutes?: {
    z1?: number;
    z2?: number;
    z3?: number;
    z4?: number;
    z5?: number;
  };
}

export interface CircuitLog {
  roundsCompleted: number;
  restBetweenRoundsSeconds?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  hrZoneMinutes?: {
    z1?: number;
    z2?: number;
    z3?: number;
    z4?: number;
    z5?: number;
  };
}

export interface AIAnalysis {
  summary: string;
  positives: string[];
  suggestions: string[];
  flags: string[];
  nextSessionTip: string;
}

/** One lap/split imported from Strava or manually entered */
export interface Lap {
  index: number;
  distanceM: number;     // meters
  elapsedSec: number;    // seconds
  avgPaceMinPerKm?: string;
  avgHR?: number;
  maxHR?: number;
  avgCadence?: number;
}

/** Actuals for one performed segment, keyed back to the planned Segment.id.
 *  Additive (see /MIGRATION_SEGMENTS.md §6): the legacy per-type log fields below
 *  stay authoritative until the migration backfills `segmentLogs`. The actuals
 *  reuse the existing legacy log shapes per kind; tightened with the segment
 *  authoring/log UI in a later step. */
export interface SegmentLog {
  segmentId: string;
  kind: SegmentKind;
  exerciseLogs?: ExerciseLog[];   // kind: "strength"
  cardioLog?: CardioLog;          // kind: "endurance"
  conditioningLog?: CircuitLog;   // kind: "conditioning"
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  date: Timestamp;
  programId?: string;
  /** Set when the logged session belongs to a group program */
  groupId?: string;
  sessionRef?: {
    cycleNumber: number;
    weekNumber: number;
    dayOfWeek: number;
  };
  plannedSession?: Session;
  actualDurationMin: number;
  perceivedRPE: number;
  mood: number;
  energyLevel: number;
  notes: string;
  exerciseLogs?: ExerciseLog[];
  cardioLog?: CardioLog;
  circuitLog?: CircuitLog;
  hiitLog?: HiitLog;
  /** New composable actuals (additive — see /MIGRATION_SEGMENTS.md §6). Optional
   *  during the migration; aligned 1:1 with the planned session's segments. */
  segmentLogs?: SegmentLog[];
  /** Lap/split data — populated when importing from Strava or Garmin */
  laps?: Lap[];
  /** Feedback written by the coach on this workout — shown to the athlete */
  coachComment?: string;
  /** Legacy: old logs may carry an AI analysis from the removed feature */
  aiAnalysis?: AIAnalysis;
  writtenBy?: "coach" | "athlete";
  createdAt: Timestamp;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export type SessionType = Session["type"];

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  strength: "Forza",
  cardio: "Cardio",
  mobility: "Mobilità",
  rest: "Riposo",
  other: "Altro",
  circuit: "Circuit",
  hiit: "HIIT",
};

export const MOOD_LABELS: Record<number, string> = {
  1: "😩",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😄",
};

export const ENERGY_LABELS: Record<number, string> = {
  1: "🪫",
  2: "😴",
  3: "⚡",
  4: "🔋",
  5: "🚀",
};
