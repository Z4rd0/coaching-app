import { describe, it, expect, vi, beforeEach } from "vitest";

// The set of documents that "exist" in a given test. resolveLogContext only
// ever does doc(path).get(), so a path→data map is a faithful stand-in for
// Firestore here.
let docs: Record<string, Record<string, unknown>> = {};

vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: () => ({
    doc: (path: string) => ({
      get: async () => ({
        exists: path in docs,
        data: () => docs[path],
      }),
    }),
  }),
}));

const { resolveLogContext } = await import("@/lib/log-auth");

const COACH = "coach-uid";
const ATHLETE_DOC = "athlete-doc-id";
const ATHLETE_UID = "athlete-uid";

beforeEach(() => {
  docs = {};
});

describe("resolveLogContext — athlete caller", () => {
  it("resolves coach+athlete from athleteAccess and ignores the body hint", () => {
    docs[`athleteAccess/${ATHLETE_UID}`] = { coachId: COACH, athleteId: ATHLETE_DOC };
    return expect(
      resolveLogContext(ATHLETE_UID, "someone-else")
    ).resolves.toEqual({
      coachId: COACH,
      athleteId: ATHLETE_DOC,
      athleteUid: ATHLETE_UID,
      callerRole: "athlete",
    });
  });
});

describe("resolveLogContext — coach on their own log", () => {
  // Regression: the coach's personal logs live at
  // coaches/{uid}/athletes/{uid}/logs with no athlete document behind them, so
  // demanding one made every edit/delete from /history/[id] fail with 403.
  it("authorizes the self path when no athleteId is sent", async () => {
    docs[`coaches/${COACH}`] = { name: "Coach" };
    await expect(resolveLogContext(COACH)).resolves.toEqual({
      coachId: COACH,
      athleteId: COACH,
      athleteUid: COACH,
      callerRole: "coach",
    });
  });

  it("authorizes the self path when athleteId equals the caller", async () => {
    docs[`coaches/${COACH}`] = { name: "Coach" };
    await expect(resolveLogContext(COACH, COACH)).resolves.toEqual({
      coachId: COACH,
      athleteId: COACH,
      athleteUid: COACH,
      callerRole: "coach",
    });
  });
});

describe("resolveLogContext — coach on an athlete's log", () => {
  it("resolves when the coach owns the athlete", async () => {
    docs[`coaches/${COACH}`] = { name: "Coach" };
    docs[`coaches/${COACH}/athletes/${ATHLETE_DOC}`] = { athleteUid: ATHLETE_UID };
    await expect(resolveLogContext(COACH, ATHLETE_DOC)).resolves.toEqual({
      coachId: COACH,
      athleteId: ATHLETE_DOC,
      athleteUid: ATHLETE_UID,
      callerRole: "coach",
    });
  });

  it("refuses an athlete the coach does not own", async () => {
    docs[`coaches/${COACH}`] = { name: "Coach" };
    await expect(resolveLogContext(COACH, "not-mine")).resolves.toBeNull();
  });
});

describe("resolveLogContext — caller who is neither", () => {
  it("refuses a uid with no athleteAccess and no coach document", async () => {
    await expect(resolveLogContext("stranger")).resolves.toBeNull();
  });

  it("refuses a stranger even when they name themselves as the athlete", async () => {
    // The self branch must be gated on actually being a coach, otherwise any
    // authenticated uid could mint a context for an arbitrary subtree.
    await expect(resolveLogContext("stranger", "stranger")).resolves.toBeNull();
  });
});
