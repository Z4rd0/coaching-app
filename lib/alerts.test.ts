import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  buildAlerts, resolveThresholds, DEFAULT_THRESHOLDS, alertRank,
  type AlertInput,
} from "@/lib/alerts";
import type { LoadSummary } from "@/lib/load";

const NOW = new Date(2026, 6, 15, 12, 0, 0);

const daysAgo = (n: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
};

const noLoad: LoadSummary = {
  weekLoad: 0, acute: 0, chronic: 0, acwr: null, monotony: null, strain: null, status: "unknown",
};

function input(over: Partial<AlertInput> = {}): AlertInput {
  return {
    logs: [],
    lastLogDate: daysAgo(1),
    load: noLoad,
    plannedLast7: 0,
    loggedLast7: 0,
    thresholds: DEFAULT_THRESHOLDS,
    now: NOW,
    ...over,
  };
}

const kinds = (input: AlertInput) => buildAlerts(input).map((a) => a.kind);

describe("inactivity", () => {
  it("stays quiet for a recently active athlete", () => {
    expect(kinds(input({ lastLogDate: daysAgo(1) }))).toEqual([]);
  });

  it("fires past the threshold and escalates at double", () => {
    const a = buildAlerts(input({ lastLogDate: daysAgo(6) }));
    expect(a[0].kind).toBe("inactivity");
    expect(a[0].severity).toBe("warning");
    expect(a[0].label).toContain("6 giorni");

    const b = buildAlerts(input({ lastLogDate: daysAgo(12) }));
    expect(b[0].severity).toBe("critical");
  });

  it("distinguishes 'never logged' from 'stopped logging'", () => {
    const a = buildAlerts(input({ lastLogDate: null }));
    expect(a[0].kind).toBe("inactivity");
    expect(a[0].label).toBe("Nessun allenamento registrato");
  });
});

describe("load", () => {
  const withAcwr = (acwr: number): LoadSummary => ({ ...noLoad, acwr, status: "optimal" });

  it("says nothing when the ratio is unknown", () => {
    // A new athlete has no 4-week baseline; flagging them would be noise they
    // cannot act on.
    expect(kinds(input({ load: noLoad }))).toEqual([]);
  });

  it("flags a spike above the band", () => {
    const a = buildAlerts(input({ load: withAcwr(1.8) }));
    expect(a[0].kind).toBe("load");
    expect(a[0].detail).toContain("1.8");
  });

  it("flags a drop below the band", () => {
    const a = buildAlerts(input({ load: withAcwr(0.3) }));
    expect(a[0].kind).toBe("load");
    expect(a[0].label).toContain("calo");
  });

  it("stays quiet inside the band", () => {
    expect(kinds(input({ load: withAcwr(1.0) }))).toEqual([]);
  });
});

describe("adherence", () => {
  it("is skipped when nothing was planned", () => {
    // 0 logged out of 0 planned is not a 0% failure — it's an athlete with no
    // program that week.
    expect(kinds(input({ plannedLast7: 0, loggedLast7: 0 }))).toEqual([]);
  });

  it("fires below the threshold with the counts in the reason", () => {
    const a = buildAlerts(input({ plannedLast7: 4, loggedLast7: 1 }));
    expect(a[0].kind).toBe("adherence");
    expect(a[0].label).toBe("Aderenza 25%");
    expect(a[0].detail).toContain("su 4 programmate");
  });

  it("stays quiet when the athlete keeps up", () => {
    expect(kinds(input({ plannedLast7: 4, loggedLast7: 4 }))).toEqual([]);
  });

  it("does not fire when the athlete trains MORE than planned", () => {
    expect(kinds(input({ plannedLast7: 3, loggedLast7: 5 }))).toEqual([]);
  });
});

describe("silence", () => {
  const logWithNote = (n: number, notes: string) => ({
    date: Timestamp.fromDate(daysAgo(n)),
    notes,
  });

  it("fires when the last note is older than the threshold", () => {
    const a = buildAlerts(input({ logs: [logWithNote(14, "gambe pesanti")] }));
    expect(a.map((x) => x.kind)).toContain("silence");
  });

  it("uses the most recent note, not the oldest", () => {
    const a = buildAlerts(input({
      logs: [logWithNote(30, "vecchia"), logWithNote(2, "recente")],
    }));
    expect(a.map((x) => x.kind)).not.toContain("silence");
  });

  it("ignores blank notes", () => {
    const a = buildAlerts(input({ logs: [logWithNote(1, "   "), logWithNote(20, "vera")] }));
    expect(a.map((x) => x.kind)).toContain("silence");
  });
});

describe("enabled flags", () => {
  it("silences a kind the coach turned off", () => {
    const thresholds = {
      ...DEFAULT_THRESHOLDS,
      enabled: { ...DEFAULT_THRESHOLDS.enabled, inactivity: false },
    };
    expect(kinds(input({ lastLogDate: daysAgo(30), thresholds }))).toEqual([]);
  });
});

describe("resolveThresholds", () => {
  it("falls back to defaults for missing or malformed values", () => {
    expect(resolveThresholds(undefined)).toEqual(DEFAULT_THRESHOLDS);
    expect(resolveThresholds({ inactivityDays: "tanti" }).inactivityDays)
      .toBe(DEFAULT_THRESHOLDS.inactivityDays);
  });

  it("keeps stored values and merges partial enabled maps", () => {
    const r = resolveThresholds({ inactivityDays: 3, enabled: { silence: false } });
    expect(r.inactivityDays).toBe(3);
    expect(r.enabled.silence).toBe(false);
    expect(r.enabled.inactivity).toBe(true);
  });
});

describe("alertRank", () => {
  it("ranks critical over warning over none", () => {
    expect(alertRank([])).toBe(0);
    expect(alertRank(buildAlerts(input({ lastLogDate: daysAgo(6) })))).toBe(1);
    expect(alertRank(buildAlerts(input({ lastLogDate: daysAgo(30) })))).toBe(2);
  });
});
