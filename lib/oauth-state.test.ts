import { describe, it, expect, vi, afterEach } from "vitest";
import { signState, verifyState } from "@/lib/oauth-state";

const SECRET = "test-secret";
const OTHER = "another-secret";

afterEach(() => vi.useRealTimers());

describe("signState / verifyState", () => {
  it("round-trips the uid", () => {
    expect(verifyState(signState("uid-123", SECRET), SECRET)).toBe("uid-123");
  });

  it("rejects a state signed with a different secret", () => {
    // Per-provider secrets: a token minted for Strava must not authenticate a
    // Tredict callback.
    expect(verifyState(signState("uid-123", OTHER), SECRET)).toBeNull();
  });

  it("rejects a tampered uid", () => {
    // Swap the uid but keep the signature: this is the attack the HMAC exists
    // to stop — binding someone else's provider account to your own uid.
    const decoded = Buffer.from(signState("victim", SECRET), "base64url").toString();
    const [, ts, sig] = decoded.split("|");
    const forged = Buffer.from(`attacker|${ts}|${sig}`).toString("base64url");
    expect(verifyState(forged, SECRET)).toBeNull();
  });

  it("rejects an expired state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T10:00:00Z"));
    const state = signState("uid-123", SECRET);
    vi.setSystemTime(new Date("2026-07-01T11:00:01Z")); // just over an hour
    expect(verifyState(state, SECRET)).toBeNull();
  });

  it("accepts a state still inside the window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T10:00:00Z"));
    const state = signState("uid-123", SECRET);
    vi.setSystemTime(new Date("2026-07-01T10:59:00Z"));
    expect(verifyState(state, SECRET)).toBe("uid-123");
  });

  it("rejects garbage instead of throwing", () => {
    for (const bad of ["", "not-base64!", Buffer.from("nobars").toString("base64url"),
                       Buffer.from("uid|notanumber|deadbeef").toString("base64url")]) {
      expect(verifyState(bad, SECRET)).toBeNull();
    }
  });

  it("tolerates a uid containing the separator", () => {
    // The parser splits from the right, so a '|' inside the uid stays intact.
    expect(verifyState(signState("weird|uid", SECRET), SECRET)).toBe("weird|uid");
  });
});
