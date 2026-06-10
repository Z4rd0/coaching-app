/**
 * Shared authorization for log read/write API routes.
 * A log is owned by exactly one (coachId, athleteId) pair, and may be touched
 * by either the coach themselves or the athlete the log belongs to.
 */
import { getAdminDb } from "./firebase-admin";

export interface LogContext {
  coachId: string;
  athleteId: string;
  /** Auth UID of the athlete who owns the log — may be missing on legacy logs */
  athleteUid?: string;
  callerRole: "coach" | "athlete";
}

/**
 * Resolves which log the caller is allowed to touch.
 * `athleteIdHint` is required when the caller is a coach (the body must say
 * which athlete's log it is); ignored for athletes (they only edit their own).
 */
export async function resolveLogContext(
  callerUid: string,
  athleteIdHint?: string
): Promise<LogContext | null> {
  const db = getAdminDb();

  // Athlete path: athleteAccess pins coachId+athleteId, so the body is ignored
  const accessSnap = await db.doc(`athleteAccess/${callerUid}`).get();
  if (accessSnap.exists) {
    const access = accessSnap.data()!;
    return {
      coachId: access.coachId,
      athleteId: access.athleteId,
      athleteUid: callerUid,
      callerRole: "athlete",
    };
  }

  // Coach path: must own the athlete the body refers to
  if (!athleteIdHint) return null;
  const athleteSnap = await db
    .doc(`coaches/${callerUid}/athletes/${athleteIdHint}`)
    .get();
  if (!athleteSnap.exists) return null;
  return {
    coachId: callerUid,
    athleteId: athleteIdHint,
    athleteUid: athleteSnap.data()?.athleteUid,
    callerRole: "coach",
  };
}
