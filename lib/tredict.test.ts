import { describe, it, expect } from "vitest";
import { normalizeTredictActivity, paceToString } from "@/lib/tredict";

/**
 * The fixture mirrors a real row returned by the Tredict MCP for one of the
 * coach's own runs (Milano, Lungo Z2 16 km). It is the closest thing to a real
 * payload available before the REST credentials arrive — see the field-mapping
 * warning at the top of lib/tredict.ts.
 */
const FLAT_ROW = {
  id: "jUT51WuZZ4AZ5CXpa31xkA",
  date: "2026-07-26T04:45:59.316Z",
  sportType: "running",
  subSportType: "generic",
  title: "Milano - Lungo Z2 — 16 km + 4x20'' strides finali",
  notes: "16km Z2 continui, poi 4x20'' allunghi.",
  "summary.duration": 5941,
  "summary.durationTotal": 6154,
  "summary.distance": 16752.4,
  "summary.pace": 355,
  "summary.speed": 2.7752744949495383,
  "summary.heartrate": 136,
  "summary.heartrateMax": 151,
  "summary.power": 423,
  "summary.cadence": 170,
  "summary.calories": 1421,
  "summary.altitude.ascent": 100,
};

describe("normalizeTredictActivity", () => {
  it("reads the flattened summary.* shape", () => {
    const a = normalizeTredictActivity(FLAT_ROW)!;
    expect(a.id).toBe("jUT51WuZZ4AZ5CXpa31xkA");
    expect(a.sportType).toBe("running");
    expect(a.durationSec).toBe(5941);
    expect(a.distanceM).toBeCloseTo(16752.4);
    expect(a.paceSecPerKm).toBe(355);
    expect(a.avgHeartrate).toBe(136);
    expect(a.maxHeartrate).toBe(151);
    expect(a.avgPower).toBe(423);
    expect(a.elevationGainM).toBe(100);
  });

  it("reads the nested summary shape too", () => {
    // Which of the two the REST API returns is unknown; supporting both means
    // the first real payload can't break the import outright.
    const a = normalizeTredictActivity({
      id: "x", date: "2026-07-26T04:45:59.316Z", sportType: "running",
      summary: { duration: 1800, distance: 5000, pace: 360, heartrate: 140 },
    })!;
    expect(a.durationSec).toBe(1800);
    expect(a.distanceM).toBe(5000);
    expect(a.paceSecPerKm).toBe(360);
    expect(a.avgHeartrate).toBe(140);
  });

  it("derives pace from speed when pace is absent", () => {
    const a = normalizeTredictActivity({
      id: "x", date: "2026-07-26T00:00:00.000Z", summary: { speed: 2.5 },
    })!;
    expect(a.paceSecPerKm).toBe(400); // 1000 / 2.5
  });

  it("parses numbers delivered as strings", () => {
    // CSV-derived payloads hand everything over as text.
    const a = normalizeTredictActivity({
      id: "x", date: "2026-07-26T00:00:00.000Z", "summary.distance": "16752.4",
    })!;
    expect(a.distanceM).toBeCloseTo(16752.4);
  });

  it("drops an activity with no id or no date", () => {
    // Both are needed to reference the activity and place it on a day; a log
    // built without them could never be reconciled with the plan.
    expect(normalizeTredictActivity({ date: "2026-07-26T00:00:00.000Z" })).toBeNull();
    expect(normalizeTredictActivity({ id: "x" })).toBeNull();
  });

  it("falls back to a title rather than producing an empty one", () => {
    const a = normalizeTredictActivity({ id: "x", date: "2026-07-26T00:00:00.000Z" })!;
    expect(a.title).toBe("Attività Tredict");
    expect(a.sportType).toBe("misc");
    expect(a.durationSec).toBe(0);
  });

  it("leaves absent metrics undefined instead of zero", () => {
    // 0 bpm would render as a real measurement; undefined renders as "—".
    const a = normalizeTredictActivity({ id: "x", date: "2026-07-26T00:00:00.000Z" })!;
    expect(a.avgHeartrate).toBeUndefined();
    expect(a.avgPower).toBeUndefined();
  });
});

describe("paceToString", () => {
  it("formats seconds per km", () => {
    expect(paceToString(355)).toBe("5:55");
    expect(paceToString(240)).toBe("4:00");
    expect(paceToString(245)).toBe("4:05");
  });

  it("carries a rounding that would render as :60", () => {
    expect(paceToString(299.7)).toBe("5:00");
  });

  it("returns an empty string for missing or nonsense values", () => {
    expect(paceToString(undefined)).toBe("");
    expect(paceToString(0)).toBe("");
    expect(paceToString(-5)).toBe("");
  });
});
