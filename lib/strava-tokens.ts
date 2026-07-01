/**
 * Strava token storage — SERVER-ONLY (Firebase Admin SDK).
 *
 * Security: the OAuth access/refresh tokens live in their own top-level
 * collection `athleteStravaTokens/{uid}` that NO client can read (default-deny
 * + an explicit `allow read, write: if false` in firestore.rules). They used to
 * live inside `athleteAccess/{uid}.strava`, which the owning coach can read —
 * meaning a coach could exfiltrate an athlete's Strava tokens (AUDIT ALTO-1).
 *
 * Migration is non-breaking: `getStravaTokens` falls back to the legacy
 * location and, on first read, copies the tokens into the secure doc and
 * deletes the coach-readable copy (migrate-on-read). The one-off backfill
 * script `scripts/migrate-strava-tokens.mjs` does the same eagerly for every
 * athlete so the coach-readable copies are scrubbed immediately.
 */
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";

export interface StoredStravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  athleteId?: number;
}

const tokenDocRef = (uid: string) =>
  getAdminDb().collection("athleteStravaTokens").doc(uid);
const legacyAccessRef = (uid: string) =>
  getAdminDb().collection("athleteAccess").doc(uid);

/** Persist freshly-issued tokens (called after the OAuth exchange). */
export async function saveStravaTokens(
  uid: string,
  tokens: StoredStravaTokens
): Promise<void> {
  await tokenDocRef(uid).set(tokens, { merge: true });
}

/**
 * Returns the caller's Strava tokens, or null if not connected.
 * Falls back to the legacy `athleteAccess/{uid}.strava` location and migrates
 * it to the secure doc on read (scrubbing the coach-readable copy).
 */
export async function getStravaTokens(
  uid: string
): Promise<StoredStravaTokens | null> {
  const snap = await tokenDocRef(uid).get();
  if (snap.exists) return snap.data() as StoredStravaTokens;

  // Legacy fallback + migrate-on-read.
  const legacySnap = await legacyAccessRef(uid).get();
  const legacy = legacySnap.data()?.strava as StoredStravaTokens | undefined;
  if (!legacy) return null;

  await tokenDocRef(uid).set(legacy, { merge: true });
  await legacyAccessRef(uid).update({ strava: FieldValue.delete() });
  return legacy;
}

/** Patch the stored tokens after a refresh (partial merge). */
export async function updateStravaTokens(
  uid: string,
  partial: Partial<StoredStravaTokens>
): Promise<void> {
  await tokenDocRef(uid).set(partial, { merge: true });
}
