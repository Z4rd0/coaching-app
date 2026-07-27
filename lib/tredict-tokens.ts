/**
 * Tredict token storage — SERVER-ONLY (Firebase Admin SDK).
 *
 * Same shape and same rule as Strava (see lib/strava-tokens.ts): the tokens
 * live in their own top-level collection that NO client can read, locked by an
 * explicit `allow read, write: if false` in firestore.rules. Strava's tokens
 * originally sat inside a coach-readable document, which meant a coach could
 * exfiltrate an athlete's tokens (AUDIT ALTO-1) — this collection starts in the
 * right place so that mistake isn't repeated.
 *
 * Note on lifetimes: Tredict access tokens last ~2 days and the refresh token
 * does not expire, so a connected athlete stays connected indefinitely unless
 * they revoke it. That makes revocation the only exit — see disconnectTredict.
 */
import { getAdminDb } from "./firebase-admin";

export interface StoredTredictTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix ms. */
  expiresAt: number;
  /** Scopes actually granted, as returned by the token endpoint. */
  scope?: string;
}

const tokenDocRef = (uid: string) =>
  getAdminDb().collection("athleteTredictTokens").doc(uid);

export async function saveTredictTokens(
  uid: string,
  tokens: StoredTredictTokens
): Promise<void> {
  await tokenDocRef(uid).set(tokens, { merge: true });
}

export async function getTredictTokens(
  uid: string
): Promise<StoredTredictTokens | null> {
  const snap = await tokenDocRef(uid).get();
  return snap.exists ? (snap.data() as StoredTredictTokens) : null;
}

export async function updateTredictTokens(
  uid: string,
  partial: Partial<StoredTredictTokens>
): Promise<void> {
  await tokenDocRef(uid).set(partial, { merge: true });
}

/** Forget the connection. The athlete should also revoke it in Tredict itself;
 *  deleting our copy only stops US from using it. */
export async function disconnectTredict(uid: string): Promise<void> {
  await tokenDocRef(uid).delete();
}
