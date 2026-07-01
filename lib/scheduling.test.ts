import { describe, it, expect } from "vitest";
import { getSessionsForDate, getUpcomingSessions } from "@/lib/firestore";
import type { Program, Session, Cycle } from "@/types";

// ── Fixtures ────────────────────────────────────────────────────────────────
// getSessionsForDate / getUpcomingSessions are the pure scheduling core. They
// only read dayOfWeek, scheduledDate and the program's startDate, so the
// sessions here carry just enough to be identifiable.

function session(partial: Partial<Session> & { title: string }): Session {
  return {
    dayOfWeek: 0,
    type: "strength",
    exercises: [],
    targetRPE: 7,
    durationMin: 60,
    notes: "",
    ...partial,
  } as Session;
}

function program(cycles: Cycle[], extra: Partial<Program> = {}): Program {
  return { id: "p1", name: "P", sport: "X", cycles, ...extra } as Program;
}

const titles = (s: Session[]) => s.map((x) => x.title).sort();

// 2026-01-05 is a Monday; 2026-01-07 Wed; 2026-01-11 Sun; 2026-01-12 Mon.
const MON_W1 = new Date(2026, 0, 5);
const WED_W1 = new Date(2026, 0, 7);
const SUN_W1 = new Date(2026, 0, 11);
const MON_W2 = new Date(2026, 0, 12);

describe("getSessionsForDate", () => {
  it("pass 1: returns sessions pinned to the exact scheduledDate", () => {
    const p = program([
      { cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [
        session({ title: "Pinned", scheduledDate: "2026-01-07", dayOfWeek: 0 }),
      ] }] },
    ]);
    expect(titles(getSessionsForDate(p, WED_W1))).toEqual(["Pinned"]);
    expect(getSessionsForDate(p, MON_W1)).toHaveLength(0);
  });

  it("pass 2: places sessions by startDate + weekIndex*7 + dayOfWeek", () => {
    const p = program(
      [
        { cycleNumber: 1, weeks: [
          { weekNumber: 1, sessions: [session({ title: "W1-Wed", dayOfWeek: 2 })] },
          { weekNumber: 2, sessions: [session({ title: "W2-Mon", dayOfWeek: 0 })] },
        ] },
      ],
      { startDate: "2026-01-05" } // Monday of week 1
    );
    expect(titles(getSessionsForDate(p, WED_W1))).toEqual(["W1-Wed"]);
    expect(titles(getSessionsForDate(p, MON_W2))).toEqual(["W2-Mon"]);
    // The week-1 Wednesday session must NOT also appear in week 2.
    expect(getSessionsForDate(p, new Date(2026, 0, 14))).toHaveLength(0);
  });

  it("pass 2: with startDate set, day-of-week recurrence is suppressed", () => {
    const p = program(
      [{ cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [
        session({ title: "W1-Mon", dayOfWeek: 0 }),
      ] }] }],
      { startDate: "2026-01-05" }
    );
    // Same weekday (Monday) one week later: no calendar session lands, and the
    // dated program must not fall back to recurring day-of-week.
    expect(getSessionsForDate(p, MON_W2)).toHaveLength(0);
  });

  it("pass 3: undated programs recur by weekday (Mon=0 … Sun=6)", () => {
    const p = program([
      { cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [
        session({ title: "EveryMon", dayOfWeek: 0 }),
        session({ title: "EverySun", dayOfWeek: 6 }),
      ] }] },
    ]);
    expect(titles(getSessionsForDate(p, MON_W1))).toEqual(["EveryMon"]);
    expect(titles(getSessionsForDate(p, MON_W2))).toEqual(["EveryMon"]);
    expect(titles(getSessionsForDate(p, SUN_W1))).toEqual(["EverySun"]);
  });

  it("returns every session that lands on the same day", () => {
    const p = program([
      { cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [
        session({ title: "A", scheduledDate: "2026-01-07" }),
        session({ title: "B", scheduledDate: "2026-01-07" }),
      ] }] },
    ]);
    expect(titles(getSessionsForDate(p, WED_W1))).toEqual(["A", "B"]);
  });
});

describe("getUpcomingSessions", () => {
  it("collects sessions across a date window in chronological order", () => {
    const p = program([
      { cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [
        session({ title: "Mon", dayOfWeek: 0 }),
        session({ title: "Wed", dayOfWeek: 2 }),
      ] }] },
    ]);
    const upcoming = getUpcomingSessions(p, 7, MON_W1);
    expect(upcoming.map((u) => u.session.title)).toEqual(["Mon", "Wed"]);
    expect(upcoming[0].date.getDay()).toBe(1); // Monday
  });
});
