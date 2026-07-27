import { describe, it, expect } from "vitest";
import { initSegmentLogs, pruneSegmentLogs } from "@/components/SegmentLogEditor";
import type { Segment, SegmentLog } from "@/types";

const strengthSeg: Segment = {
  id: "s1",
  kind: "strength",
  title: "Forza",
  groups: [
    { items: [{ name: "Squat", sets: 5, reps: "5", load: "100kg", notes: "" }] },
    { items: [{ name: "Panca", sets: 3, reps: "8", load: "60kg", notes: "" }] },
  ],
};
const enduranceSeg: Segment = { id: "e1", kind: "endurance", format: "continuous", steps: [] };
const conditioningSeg: Segment = {
  id: "c1", kind: "conditioning", structure: "rounds", rounds: 5, movements: [],
};
const noteSeg: Segment = { id: "n1", kind: "note" };

describe("initSegmentLogs", () => {
  it("keys each log to its segment id, in order", () => {
    const logs = initSegmentLogs([strengthSeg, enduranceSeg, conditioningSeg, noteSeg]);
    expect(logs.map((l) => l.segmentId)).toEqual(["s1", "e1", "c1", "n1"]);
    expect(logs.map((l) => l.kind)).toEqual(["strength", "endurance", "conditioning", "note"]);
  });

  it("flattens strength groups into one exercise row each, pre-filled from the plan", () => {
    const [log] = initSegmentLogs([strengthSeg]);
    expect(log.exerciseLogs).toHaveLength(2);
    expect(log.exerciseLogs![0]).toMatchObject({
      name: "Squat", plannedSets: 5, plannedReps: "5", actualSets: 5, actualReps: "5",
    });
  });

  it("seeds conditioning rounds from the planned rounds", () => {
    const [log] = initSegmentLogs([conditioningSeg]);
    expect(log.conditioningLog?.roundsCompleted).toBe(5);
  });
});

describe("pruneSegmentLogs", () => {
  it("drops blocks the user left completely empty", () => {
    // Every hybrid starts with a blank log per block; writing them all back
    // would fill Firestore with empty objects that read as "logged nothing".
    const logs: SegmentLog[] = [
      { segmentId: "e1", kind: "endurance", cardioLog: {} },
      { segmentId: "n1", kind: "note" },
    ];
    expect(pruneSegmentLogs(logs)).toEqual([]);
  });

  it("keeps a block with any actual value", () => {
    const logs: SegmentLog[] = [
      { segmentId: "e1", kind: "endurance", cardioLog: { distanceMeters: 5000 } },
      { segmentId: "n1", kind: "note" },
    ];
    expect(pruneSegmentLogs(logs).map((l) => l.segmentId)).toEqual(["e1"]);
  });

  it("keeps a block that only has notes", () => {
    const logs: SegmentLog[] = [{ segmentId: "n1", kind: "note", notes: "duro" }];
    expect(pruneSegmentLogs(logs)).toHaveLength(1);
  });

  it("ignores cardio objects whose fields are all undefined", () => {
    const logs: SegmentLog[] = [
      { segmentId: "e1", kind: "endurance", cardioLog: { avgHeartRate: undefined } },
    ];
    expect(pruneSegmentLogs(logs)).toEqual([]);
  });
});
