import type { Cycle, Week, Session, Exercise } from "@/types";

export function emptyExercise(): Exercise {
  return { name: "", sets: 3, reps: "8", load: "", notes: "" };
}
export function emptySession(dayOfWeek = 0): Session {
  return { dayOfWeek, type: "strength", title: "", exercises: [emptyExercise()], targetRPE: 7, durationMin: 60, notes: "" };
}
export function emptyWeek(weekNumber: number): Week {
  return { weekNumber, sessions: [] };
}
export function emptyCycle(cycleNumber: number): Cycle {
  return { cycleNumber, weeks: [emptyWeek(1)] };
}
