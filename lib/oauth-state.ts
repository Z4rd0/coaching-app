import crypto from "crypto";

/**
 * HMAC-signed OAuth `state` tokens.
 *
 * The callback has to know which user started the flow, and it must not trust
 * the query string to tell it: an unsigned state is an open invitation to bind
 * someone else's provider account to your uid. Signing lets the callback prove
 * the uid came from us without writing anything to the database before the
 * exchange completes.
 *
 * Shared by every provider (Strava, Tredict, …) — each passes its own secret,
 * so a leaked secret can't be replayed against another provider.
 */

/** How long a state token stays valid. An OAuth round-trip is seconds; an hour
 *  is generous and still bounds replay. */
const MAX_AGE_MS = 3_600_000;

export function signState(uid: string, secret: string): string {
  const ts = Date.now().toString();
  const payload = `${uid}|${ts}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

/** Returns the uid when the state is authentic and fresh, otherwise null. */
export function verifyState(state: string, secret: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString();
    // Format: uid|timestamp|hex-signature
    const lastBar = decoded.lastIndexOf("|");
    const secondLastBar = decoded.lastIndexOf("|", lastBar - 1);
    if (lastBar < 0 || secondLastBar < 0) return null;

    const sig = decoded.slice(lastBar + 1);
    const payload = decoded.slice(0, lastBar);
    const ts = parseInt(decoded.slice(secondLastBar + 1, lastBar), 10);
    const uid = decoded.slice(0, secondLastBar);

    if (!uid || isNaN(ts) || Date.now() - ts > MAX_AGE_MS) return null;

    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    // Length-check before timingSafeEqual, which throws on mismatched buffers.
    const sigBuf = Buffer.from(sig.padEnd(expected.length, "0"), "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    return uid;
  } catch {
    return null;
  }
}
