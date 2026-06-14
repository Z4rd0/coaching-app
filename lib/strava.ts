/**
 * Strava OAuth helpers — server-side only.
 * Uses HMAC-signed state tokens so the callback can identify the user
 * without storing anything in the database before the OAuth completes.
 */
import crypto from "crypto";

// ─── State signing ────────────────────────────────────────────────────────────

export function signStravaState(uid: string): string {
  const ts = Date.now().toString();
  const payload = `${uid}|${ts}`;
  const sig = crypto
    .createHmac("sha256", process.env.STRAVA_STATE_SECRET!)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export function verifyStravaState(state: string): string | null {
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

    if (!uid || isNaN(ts) || Date.now() - ts > 3_600_000) return null;

    const expected = crypto
      .createHmac("sha256", process.env.STRAVA_STATE_SECRET!)
      .update(payload)
      .digest("hex");

    const sigBuf = Buffer.from(sig.padEnd(expected.length, "0"), "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    return uid;
  } catch {
    return null;
  }
}

// ─── OAuth URLs ───────────────────────────────────────────────────────────────

export function stravaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:read",
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

// ─── Token exchange & refresh ─────────────────────────────────────────────────

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  athleteId: number;
}

export async function exchangeStravaCode(code: string): Promise<StravaTokens> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at * 1000,
    athleteId: data.athlete?.id ?? 0,
  };
}

export async function refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at * 1000,
    athleteId: 0, // not returned on refresh, keep existing
  };
}

// ─── Strava activity types ─────────────────────────────────────────────────────

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  start_date: string;       // ISO
  elapsed_time: number;     // seconds
  moving_time: number;      // seconds
  distance: number;         // meters
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  average_speed?: number;   // m/s
  total_elevation_gain?: number;
}

export async function fetchStravaActivities(
  accessToken: string,
  perPage = 10
): Promise<StravaActivity[]> {
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`);
  return res.json();
}

export interface StravaLap {
  lap_index: number;
  elapsed_time: number;   // seconds
  moving_time: number;
  distance: number;       // meters
  average_speed?: number; // m/s
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
}

export async function fetchStravaLaps(
  accessToken: string,
  activityId: number
): Promise<StravaLap[]> {
  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}/laps`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Strava laps fetch failed: ${res.status}`);
  return res.json();
}

// ─── Unit helpers ─────────────────────────────────────────────────────────────

export function metersToKm(m: number): number {
  return Math.round(m / 10) / 100;
}

export function speedToPace(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return "";
  const minPerKm = 1000 / speedMs / 60;
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
