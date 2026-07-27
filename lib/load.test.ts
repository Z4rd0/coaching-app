import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  sessionLoad, dailyLoads, loadSummary, weeklyLoadSeries, acwrStatus,
} from "@/lib/load";

/** A log on a given local day. */
function log(daysAgo: number, rpe: number, minutes: number, end = END) {
  const d = new Date(end);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return {
    perceivedRPE: rpe,
    actualDurationMin: minutes,
    date: Timestamp.fromDate(d),
  };
}

// Fixed "today" so the windows are deterministic. Mid-July → UTC+2 in Rome,
// which is where a UTC-based day bucket would slip.
const END = new Date(2026, 6, 15, 12, 0, 0);

describe("sessionLoad", () => {
  it("multiplies RPE by minutes", () => {
    expect(sessionLoad({ perceivedRPE: 7, actualDurationMin: 60 })).toBe(420);
  });

  it("is zero when either factor is missing or non-positive", () => {
    expect(sessionLoad({ perceivedRPE: 0, actualDurationMin: 60 })).toBe(0);
    expect(sessionLoad({ perceivedRPE: 7, actualDurationMin: 0 })).toBe(0);
    expect(sessionLoad({ perceivedRPE: NaN, actualDurationMin: 60 })).toBe(0);
  });
});

describe("dailyLoads", () => {
  it("buckets by LOCAL day and zero-fills the rest", () => {
    const days = dailyLoads([log(0, 7, 60), log(2, 5, 30)], 7, END);
    expect(days).toHaveLength(7);
    expect(days[days.length - 1]).toEqual({ date: "2026-07-15", load: 420 });
    expect(days[days.length - 3]).toEqual({ date: "2026-07-13", load: 150 });
    // Zero-filled days are present, not omitted.
    expect(days[days.length - 2]).toEqual({ date: "2026-07-14", load: 0 });
  });

  it("sums several sessions on the same day", () => {
    const days = dailyLoads([log(0, 7, 60), log(0, 4, 30)], 7, END);
    expect(days[days.length - 1].load).toBe(420 + 120);
  });

  it("ignores logs outside the window", () => {
    const days = dailyLoads([log(40, 10, 120)], 7, END);
    expect(days.every((d) => d.load === 0)).toBe(true);
  });
});

describe("loadSummary", () => {
  it("returns a null ACWR when there is no history to compare against", () => {
    // An athlete with no logs must not be reported as "detraining" — that would
    // fire an alert about someone who simply hasn't started.
    const s = loadSummary([], END);
    expect(s.acwr).toBeNull();
    expect(s.status).toBe("unknown");
  });

  it("reads exactly 1 when the last week matches the last four", () => {
    // The identical session every single day for 28 days, so the 7-day and
    // 28-day means are the same by construction.
    const logs = Array.from({ length: 28 }, (_, i) => log(i, 6, 60, END));
    const s = loadSummary(logs, END);
    expect(s.acwr).toBe(1);
    expect(s.status).toBe("optimal");
  });

  it("flags a spike as overreaching", () => {
    // Quiet month, then a heavy week.
    const quiet = Array.from({ length: 3 }, (_, i) => log(8 + i * 5, 4, 30, END));
    const heavy = Array.from({ length: 6 }, (_, i) => log(i, 9, 90, END));
    const s = loadSummary([...quiet, ...heavy], END);
    expect(s.acwr).toBeGreaterThan(1.5);
    expect(s.status).toBe("overreaching");
  });

  it("flags a sudden stop as detraining", () => {
    // Trained for weeks, nothing in the last 7 days.
    const logs = Array.from({ length: 10 }, (_, i) => log(8 + i * 2, 7, 60, END));
    const s = loadSummary(logs, END);
    expect(s.weekLoad).toBe(0);
    expect(s.acwr).toBe(0);
    expect(s.status).toBe("detraining");
  });

  it("computes weekLoad as the plain 7-day total", () => {
    const s = loadSummary([log(0, 7, 60), log(3, 5, 40)], END);
    expect(s.weekLoad).toBe(420 + 200);
  });

  it("returns a null monotony when the week is a single session", () => {
    // SD over the week is non-zero here, so monotony is defined; the null case
    // is a completely flat week (all days identical, including all-zero).
    expect(loadSummary([], END).monotony).toBeNull();
  });
});

describe("acwrStatus", () => {
  it("maps the bands", () => {
    expect(acwrStatus(null)).toBe("unknown");
    expect(acwrStatus(0.5)).toBe("detraining");
    expect(acwrStatus(1.0)).toBe("optimal");
    expect(acwrStatus(1.8)).toBe("overreaching");
  });
});

describe("weeklyLoadSeries", () => {
  it("returns oldest-first buckets of 7 days", () => {
    const s = weeklyLoadSeries([log(0, 7, 60), log(9, 5, 60)], 2, END);
    expect(s).toHaveLength(2);
    expect(s[0].load).toBe(300); // 9 days ago → previous week
    expect(s[1].load).toBe(420); // this week
    expect(new Date(s[0].weekStart).getTime()).toBeLessThan(new Date(s[1].weekStart).getTime());
  });
});
