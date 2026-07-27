import { describe, it, expect } from "vitest";
import {
  getSessionsForDate,
  getScheduledSessionsForDate,
  getUpcomingSessions,
  getTodaySession,
  findSessionCoords,
} from "@/lib/firestore";
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

  // The day-of-week fallback is gone: a weekday alone cannot say which week of
  // the program we are in, so it collapsed every week of a cycle onto the same
  // day. startDate is required at every authoring entry point now.
  it("places nothing for a program with no startDate", () => {
    const p = program([
      { cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [
        session({ title: "EveryMon", dayOfWeek: 0 }),
        session({ title: "EverySun", dayOfWeek: 6 }),
      ] }] },
    ]);
    expect(getSessionsForDate(p, MON_W1)).toHaveLength(0);
    expect(getSessionsForDate(p, SUN_W1)).toHaveLength(0);
  });

  it("still honours scheduledDate when the program has no startDate", () => {
    // Pinned sessions are absolute dates — they do not depend on the anchor, so
    // a session explicitly moved onto a day must survive.
    const p = program([
      { cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [
        session({ title: "Moved", scheduledDate: "2026-01-07", dayOfWeek: 0 }),
        session({ title: "Floating", dayOfWeek: 0 }),
      ] }] },
    ]);
    expect(titles(getSessionsForDate(p, WED_W1))).toEqual(["Moved"]);
    expect(getSessionsForDate(p, MON_W1)).toHaveLength(0);
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

  // Regression guard for the UTC off-by-one: the suite runs in Europe/Rome
  // (see vitest.config.ts), where converting a local Date to an ISO string
  // yields the *previous* calendar day. A session pinned to day X must be
  // visible on day X — never on X-1 — whatever hour of the day we ask about.
  it("matches scheduledDate against the LOCAL calendar day", () => {
    const p = program([
      { cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [
        session({ title: "Pinned", scheduledDate: "2026-07-07" }),
      ] }] },
    ]);
    // Summer (UTC+2) and winter (UTC+1), at midnight and late evening.
    expect(titles(getSessionsForDate(p, new Date(2026, 6, 7)))).toEqual(["Pinned"]);
    expect(titles(getSessionsForDate(p, new Date(2026, 6, 7, 23, 59)))).toEqual(["Pinned"]);
    // …and must NOT leak onto the day before.
    expect(getSessionsForDate(p, new Date(2026, 6, 6))).toHaveLength(0);
    expect(getSessionsForDate(p, new Date(2026, 6, 6, 23, 59))).toHaveLength(0);
  });
});

describe("getScheduledSessionsForDate", () => {
  it("carries the cycle/week coordinates of each placed session", () => {
    const p = program(
      [
        { cycleNumber: 1, weeks: [
          { weekNumber: 1, sessions: [session({ title: "W1-Mon", dayOfWeek: 0 })] },
          { weekNumber: 2, sessions: [session({ title: "W2-Mon", dayOfWeek: 0 })] },
        ] },
      ],
      { startDate: "2026-01-05" }
    );
    expect(getScheduledSessionsForDate(p, MON_W2)).toEqual([
      { session: expect.objectContaining({ title: "W2-Mon" }), cycleNumber: 1, weekNumber: 2 },
    ]);
  });

  it("agrees with getSessionsForDate on which sessions are placed", () => {
    const p = program(
      [
        { cycleNumber: 3, weeks: [{ weekNumber: 4, sessions: [
          session({ title: "A", scheduledDate: "2026-01-07" }),
          session({ title: "B", dayOfWeek: 2 }),
        ] }] },
      ],
      { startDate: "2026-01-05" }
    );
    expect(getScheduledSessionsForDate(p, WED_W1).map((s) => s.session))
      .toEqual(getSessionsForDate(p, WED_W1));
    expect(getScheduledSessionsForDate(p, WED_W1).map((s) => s.weekNumber)).toEqual([4, 4]);
  });
});

describe("getUpcomingSessions", () => {
  it("collects sessions across a date window in chronological order", () => {
    const p = program(
      [
        { cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [
          session({ title: "Mon", dayOfWeek: 0 }),
          session({ title: "Wed", dayOfWeek: 2 }),
        ] }] },
      ],
      { startDate: "2026-01-05" }
    );
    const upcoming = getUpcomingSessions(p, 7, MON_W1);
    expect(upcoming.map((u) => u.session.title)).toEqual(["Mon", "Wed"]);
    expect(upcoming[0].date.getDay()).toBe(1); // Monday
  });
});

describe("findSessionCoords", () => {
  it("returns the array indices, which are NOT the cycle/week numbers", () => {
    // A program whose numbering doesn't start at 1: the log links address
    // sessions positionally, so returning cycleNumber/weekNumber here would
    // point at the wrong session.
    const target = session({ title: "Target", dayOfWeek: 1 });
    const p = program([
      { cycleNumber: 7, weeks: [
        { weekNumber: 3, sessions: [session({ title: "Other" })] },
        { weekNumber: 4, sessions: [session({ title: "Filler" }), target] },
      ] },
    ]);
    expect(findSessionCoords(p, target)).toEqual({ ci: 0, wi: 1, si: 1 });
  });

  it("round-trips the session shown by getTodaySession", () => {
    // This is the pairing the dashboard cards rely on: locate what is displayed,
    // then hand those indices to the log page.
    const p = program(
      [
        { cycleNumber: 1, weeks: [
          { weekNumber: 1, sessions: [session({ title: "W1-Mon", dayOfWeek: 0 })] },
          { weekNumber: 2, sessions: [session({ title: "W2-Mon", dayOfWeek: 0 })] },
        ] },
      ],
      { startDate: "2026-01-05" }
    );
    const today = getTodaySession(p, MON_W2)!;
    const coords = findSessionCoords(p, today)!;
    expect(p.cycles[coords.ci].weeks[coords.wi].sessions[coords.si]).toBe(today);
    expect(today.title).toBe("W2-Mon");
  });

  it("distinguishes structurally identical sessions by reference", () => {
    const a = session({ title: "Squat", dayOfWeek: 0 });
    const b = session({ title: "Squat", dayOfWeek: 0 });
    const p = program([
      { cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [a, b] }] },
    ]);
    expect(findSessionCoords(p, a)).toEqual({ ci: 0, wi: 0, si: 0 });
    expect(findSessionCoords(p, b)).toEqual({ ci: 0, wi: 0, si: 1 });
  });

  it("returns null for a session from another program", () => {
    const p = program([{ cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [] }] }]);
    expect(findSessionCoords(p, session({ title: "Stranger" }))).toBeNull();
  });
});
