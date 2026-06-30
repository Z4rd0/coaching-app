import { describe, it, expect } from "vitest";
import { normalizeSession } from "@/lib/segments";
import type {
  Session,
  Segment,
  StrengthSegment,
  EnduranceSegment,
  ConditioningSegment,
  Exercise,
} from "@/types";

function session(partial: Partial<Session> & { type: Session["type"] }): Session {
  return {
    dayOfWeek: 0,
    title: "S",
    exercises: [],
    targetRPE: 7,
    durationMin: 60,
    notes: "",
    ...partial,
  } as Session;
}

const ex = (name: string, over: Partial<Exercise> = {}): Exercise => ({
  name,
  sets: 3,
  reps: "8",
  load: "60kg",
  notes: "",
  ...over,
});

describe("normalizeSession — passthrough", () => {
  it("returns authored segments unchanged (never re-derives)", () => {
    const seg: Segment = { id: "auth-1", kind: "note", title: "x" };
    const s = session({ type: "strength", segments: [seg] });
    const out = normalizeSession(s);
    expect(out).toBe(s.segments); // same reference
    expect(out).toEqual([seg]);
  });
});

describe("normalizeSession — legacy synthesis by type", () => {
  it("strength → one strength segment, one singleton group per exercise", () => {
    const out = normalizeSession(
      session({ type: "strength", exercises: [ex("Squat"), ex("Bench")] })
    );
    expect(out).toHaveLength(1);
    const seg = out[0] as StrengthSegment;
    expect(seg.kind).toBe("strength");
    expect(seg.id).toBe("seg-0");
    expect(seg.purpose).toBeUndefined();
    expect(seg.groups.map((g) => g.items.map((i) => i.name))).toEqual([
      ["Squat"],
      ["Bench"],
    ]);
  });

  it("mobility → strength segment tagged purpose=mobility", () => {
    const seg = normalizeSession(
      session({ type: "mobility", exercises: [ex("Hip opener")] })
    )[0] as StrengthSegment;
    expect(seg.kind).toBe("strength");
    expect(seg.purpose).toBe("mobility");
    expect(seg.groups).toHaveLength(1);
  });

  it("other with exercises → strength; other without → note", () => {
    const withEx = normalizeSession(session({ type: "other", exercises: [ex("X")] }))[0];
    expect(withEx.kind).toBe("strength");
    const empty = normalizeSession(session({ type: "other", exercises: [] }))[0];
    expect(empty.kind).toBe("note");
  });

  it("cardio → endurance segment, format + steps from intervals", () => {
    const seg = normalizeSession(
      session({
        type: "cardio",
        cardioFormat: "intervals",
        intervals: [{ reps: 5, work: { distanceM: 1000, targetPace: "4:00/km" } }],
      })
    )[0] as EnduranceSegment;
    expect(seg.kind).toBe("endurance");
    expect(seg.format).toBe("intervals");
    expect(seg.steps).toHaveLength(1);
    expect(seg.steps[0].work.distanceM).toBe(1000);
  });

  it("cardio without cardioFormat defaults to continuous with empty steps", () => {
    const seg = normalizeSession(session({ type: "cardio" }))[0] as EnduranceSegment;
    expect(seg.format).toBe("continuous");
    expect(seg.steps).toEqual([]);
  });

  it("circuit → conditioning rounds; rest-between-rounds on the last movement", () => {
    const seg = normalizeSession(
      session({
        type: "circuit",
        targetRounds: 4,
        restBetweenRoundsSeconds: 90,
        exercises: [ex("Burpee"), ex("KB swing")],
      })
    )[0] as ConditioningSegment;
    expect(seg.kind).toBe("conditioning");
    expect(seg.structure).toBe("rounds");
    expect(seg.rounds).toBe(4);
    expect(seg.movements.map((m) => m.name)).toEqual(["Burpee", "KB swing"]);
    expect(seg.movements[1].restSeconds).toBe(90);
    expect(seg.movements[0].restSeconds).toBeUndefined();
  });

  it("hiit → conditioning, structure from hiitFormat, rounds from a single block", () => {
    const seg = normalizeSession(
      session({
        type: "hiit",
        hiitFormat: "amrap",
        hiitTotalSeconds: 1200,
        hiitBlocks: [
          {
            rounds: 5,
            intervals: [
              { label: "Work", durationSeconds: 40, isRest: false },
              { label: "Rest", durationSeconds: 20, isRest: true },
            ],
          },
        ],
      })
    )[0] as ConditioningSegment;
    expect(seg.kind).toBe("conditioning");
    expect(seg.structure).toBe("amrap");
    expect(seg.timeCapSec).toBe(1200);
    expect(seg.rounds).toBe(5);
    expect(seg.movements).toEqual([
      { name: "Work", durationSec: 40 },
      { name: "Rest", restSeconds: 20 },
    ]);
  });

  it("hiit with unknown/absent format falls back to interval; multi-block omits rounds", () => {
    const seg = normalizeSession(
      session({
        type: "hiit",
        hiitBlocks: [
          { rounds: 3, intervals: [{ label: "A", durationSeconds: 30, isRest: false }] },
          { rounds: 2, intervals: [{ label: "B", durationSeconds: 30, isRest: false }] },
        ],
      })
    )[0] as ConditioningSegment;
    expect(seg.structure).toBe("interval");
    expect(seg.rounds).toBeUndefined();
    expect(seg.movements.map((m) => m.name)).toEqual(["A", "B"]);
  });

  it("rest → rest segment", () => {
    const seg = normalizeSession(session({ type: "rest", title: "Riposo" }))[0];
    expect(seg.kind).toBe("rest");
    expect(seg.title).toBe("Riposo");
  });

  it("unknown/malformed type → note segment (never throws)", () => {
    // Defensive default branch: data may carry a type outside the union.
    const seg = normalizeSession(session({ type: "bogus" as Session["type"] }))[0];
    expect(seg.kind).toBe("note");
  });
});

describe("normalizeSession — purity", () => {
  it("is deterministic and does not mutate its input", () => {
    const s = session({
      type: "circuit",
      targetRounds: 3,
      restBetweenRoundsSeconds: 60,
      exercises: [ex("Row"), ex("Push-up")],
    });
    const snapshot = JSON.parse(JSON.stringify(s));
    const a = normalizeSession(s);
    const b = normalizeSession(s);
    expect(a).toEqual(b); // deterministic
    expect(s).toEqual(snapshot); // input untouched (no rest leaked onto source exercises)
  });
});
