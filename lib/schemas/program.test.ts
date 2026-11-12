import { describe, expect, it } from "vitest";
import { programImportSchema } from "@/lib/schemas/program";

const validProgram = {
  name: "Forza base",
  sport: "Powerlifting",
  cycles: [{
    cycleNumber: 1,
    weeks: [{
      weekNumber: 1,
      sessions: [{
        dayOfWeek: 0,
        type: "strength",
        title: "Squat",
        exercises: [],
      }],
    }],
  }],
};

describe("programImportSchema", () => {
  it("rejects a malformed JSON import before the preview is rendered", () => {
    expect(programImportSchema.safeParse({ name: "Senza cicli" }).success).toBe(false);
  });

  it("coerces common AI values while preserving a valid program", () => {
    const result = programImportSchema.safeParse({
      ...validProgram,
      cycles: [{
        ...validProgram.cycles[0],
        weeks: [{
          ...validProgram.cycles[0].weeks[0],
          sessions: [{
            ...validProgram.cycles[0].weeks[0].sessions[0],
            dayOfWeek: "0",
            exercises: [{ name: "Squat", sets: "3", reps: 5 }],
          }],
        }],
      }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const session = result.data.cycles[0].weeks[0].sessions[0];
      expect(session.dayOfWeek).toBe(0);
      expect(session.exercises[0]).toMatchObject({ sets: 3, reps: "5" });
    }
  });
});
