import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase/firestore";
import { parseLoadKg, parseReps, exerciseRecords, recordsSetBy } from "@/lib/records";
import type { ExerciseLog } from "@/types";

const NOW = new Date(2026, 6, 15, 12, 0, 0);

function logAt(id: string, daysAgo: number, exercises: Partial<ExerciseLog>[]) {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return {
    id,
    date: Timestamp.fromDate(d),
    exerciseLogs: exercises as ExerciseLog[],
  };
}

describe("parseLoadKg", () => {
  it("reads plain and unit-suffixed weights", () => {
    expect(parseLoadKg("80")).toBe(80);
    expect(parseLoadKg("80kg")).toBe(80);
    expect(parseLoadKg("82.5 kg")).toBe(82.5);
    expect(parseLoadKg("82,5kg")).toBe(82.5);
  });

  it("converts pounds", () => {
    expect(parseLoadKg("100 lb")).toBeCloseTo(45.4, 1);
  });

  it("totals per-side dumbbell notation", () => {
    expect(parseLoadKg("2x24kg")).toBe(48);
    expect(parseLoadKg("2 × 24 kg")).toBe(48);
  });

  it("refuses what it cannot know", () => {
    // A percentage is relative to a 1RM we don't store, and bodyweight has no
    // number — inventing a value here would produce a PR the athlete believes.
    expect(parseLoadKg("70% 1RM")).toBeNull();
    expect(parseLoadKg("bodyweight")).toBeNull();
    expect(parseLoadKg("")).toBeNull();
    expect(parseLoadKg(undefined)).toBeNull();
  });
});

describe("parseReps", () => {
  it("takes the first number of a range", () => {
    expect(parseReps("8")).toBe(8);
    expect(parseReps("8-10")).toBe(8);
  });
  it("returns null for open-ended prescriptions", () => {
    expect(parseReps("AMRAP")).toBeNull();
    expect(parseReps(undefined)).toBeNull();
  });
});

describe("exerciseRecords", () => {
  const history = [
    logAt("a", 200, [{ name: "Squat", actualLoad: "100kg", actualReps: "5" }]),
    logAt("b", 100, [{ name: "Squat", actualLoad: "110kg", actualReps: "3" }]),
    logAt("c", 10, [{ name: "Squat", actualLoad: "105kg", actualReps: "5" }]),
    logAt("d", 5, [{ name: "Panca", actualLoad: "70kg", actualReps: "8" }]),
  ];

  it("keeps the heaviest set per exercise, best first", () => {
    const r = exerciseRecords(history, "all", NOW);
    expect(r.map((x) => x.exercise)).toEqual(["Squat", "Panca"]);
    expect(r[0].loadKg).toBe(110);
    expect(r[0].reps).toBe(3);
  });

  it("respects the time window", () => {
    // Within 3 months the 110kg (100 days ago) is out of range.
    const r = exerciseRecords(history, "3m", NOW);
    expect(r.find((x) => x.exercise === "Squat")?.loadKg).toBe(105);
  });

  it("matches exercise names case-insensitively", () => {
    const r = exerciseRecords(
      [logAt("a", 1, [{ name: "squat", actualLoad: "90kg" }]),
       logAt("b", 2, [{ name: "Squat", actualLoad: "95kg" }])],
      "all", NOW
    );
    expect(r).toHaveLength(1);
    expect(r[0].loadKg).toBe(95);
  });

  it("skips entries with no parseable load", () => {
    const r = exerciseRecords([logAt("a", 1, [{ name: "Plank", actualLoad: "bodyweight" }])], "all", NOW);
    expect(r).toEqual([]);
  });
});

describe("recordsSetBy", () => {
  const older = logAt("old", 30, [{ name: "Squat", actualLoad: "100kg" }]);

  it("reports an exercise that beats everything earlier", () => {
    const today = logAt("new", 0, [{ name: "Squat", actualLoad: "105kg" }]);
    const r = recordsSetBy(today, [older, today]);
    expect(r).toEqual([{ exercise: "Squat", loadKg: 105, previousKg: 100 }]);
  });

  it("reports a first-ever lift with no previous mark", () => {
    const today = logAt("new", 0, [{ name: "Stacco", actualLoad: "120kg" }]);
    const r = recordsSetBy(today, [older, today]);
    expect(r[0].previousKg).toBeNull();
  });

  it("says nothing when the lift doesn't beat the old mark", () => {
    const today = logAt("new", 0, [{ name: "Squat", actualLoad: "95kg" }]);
    expect(recordsSetBy(today, [older, today])).toEqual([]);
  });

  it("ignores logs that came after this one", () => {
    // A record is new relative to what existed then; a heavier session next
    // month must not retroactively erase it.
    const today = logAt("new", 10, [{ name: "Squat", actualLoad: "105kg" }]);
    const future = logAt("future", 0, [{ name: "Squat", actualLoad: "130kg" }]);
    const r = recordsSetBy(today, [older, today, future]);
    expect(r).toHaveLength(1);
    expect(r[0].loadKg).toBe(105);
  });

  it("does not compare a log against itself", () => {
    const today = logAt("only", 0, [{ name: "Squat", actualLoad: "105kg" }]);
    expect(recordsSetBy(today, [today])[0].previousKg).toBeNull();
  });
});
