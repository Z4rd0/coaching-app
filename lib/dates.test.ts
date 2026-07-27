import { describe, it, expect } from "vitest";
import { toLocalISODate, fromLocalISODate, todayISO } from "@/lib/dates";

describe("toLocalISODate", () => {
  it("names the local calendar day, not the UTC one", () => {
    // Local midnight. In any UTC+ zone `toISOString().slice(0,10)` reports
    // 2026-01-06 here — the bug this helper exists to prevent.
    expect(toLocalISODate(new Date(2026, 0, 7))).toBe("2026-01-07");
    // Late evening: the UTC clock has already rolled over to the 8th.
    expect(toLocalISODate(new Date(2026, 0, 7, 23, 30))).toBe("2026-01-07");
  });

  it("zero-pads month and day", () => {
    expect(toLocalISODate(new Date(2026, 2, 5))).toBe("2026-03-05");
  });
});

describe("fromLocalISODate", () => {
  it("parses an ISO day as local midnight", () => {
    const d = fromLocalISODate("2026-01-07");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(7);
    expect(d.getHours()).toBe(0);
  });

  it("round-trips with toLocalISODate", () => {
    for (const iso of ["2026-01-07", "2026-03-29", "2026-10-25", "2026-12-31"]) {
      expect(toLocalISODate(fromLocalISODate(iso))).toBe(iso);
    }
  });
});

describe("todayISO", () => {
  it("matches the local components of now", () => {
    expect(todayISO()).toBe(toLocalISODate(new Date()));
  });
});
