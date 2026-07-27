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
 * `athleteIdHint` names the athlete whose log it is; it is required when a coach
 * touches a real athlete's log, ignored for athletes (they only edit their own),
 * and optional for a coach editing their own training log.
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

  // Everything below is the coach path — prove they are one before trusting the
  // hint, so a caller with no athleteAccess doc can't reach these branches.
  const coachSnap = await db.doc(`coaches/${callerUid}`).get();
  if (!coachSnap.exists) return null;

  // Self path: the coach trains too, and their own logs live under
  // coaches/{uid}/athletes/{uid}/logs — a path with no athlete document behind
  // it (the coach is not their own client). Requiring that document here is what
  // used to make every edit/delete of a coach's personal log fail with 403.
  if (!athleteIdHint || athleteIdHint === callerUid) {
    return {
      coachId: callerUid,
      athleteId: callerUid,
      athleteUid: callerUid,
      callerRole: "coach",
    };
  }

  // Coach-on-athlete path: must own the athlete the body refers to
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
