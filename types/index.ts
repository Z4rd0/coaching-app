import { Timestamp } from "firebase/firestore";

// ─── Coach ───────────────────────────────────────────────────────────────────

export interface Coach {
  id: string;
  name: string;
  email: string;
  createdAt: Timestamp;
  settings: Record<string, unknown>;
}

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
  garminConnected: boolean;
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

export interface Session {
  dayOfWeek: number; // 0 = Monday … 6 = Sunday
  /** Optional ISO date "YYYY-MM-DD" — when set, overrides dayOfWeek
   *  for scheduling. Lets the coach pin a session to a precise calendar day. */
  scheduledDate?: string;
  type: "strength" | "cardio" | "mobility" | "rest" | "other";
  title: string;
  exercises: Exercise[];
  targetRPE: number; // 1-10
  durationMin: number;
  notes: string;
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

// ─── Workout Log ──────────────────────────────────────────────────────────────

export interface GarminData {
  activityType: string;
  distanceMeters?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  avgPace?: string;
}

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

export interface AIAnalysis {
  summary: string;
  positives: string[];
  suggestions: string[];
  flags: string[];
  nextSessionTip: string;
}

export interface WorkoutLog {
  id: string;
  date: Timestamp;
  programId?: string;
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
  garminActivityId?: string;
  garminData?: GarminData;
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
