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

export interface HiitLog {
  roundsCompleted: number;
  totalTimeSeconds?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
}

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
