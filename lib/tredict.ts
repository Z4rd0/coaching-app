/**
 * Tredict OAuth2 + activity API — server-side only.
 *
 * Tredict aggregates Garmin/Coros/Suunto/Polar/Wahoo and republishes the
 * activity with derived running metrics, which is why it is worth a direct
 * integration where a Garmin one isn't available to us.
 *
 * ⚠️ FIELD MAPPING IS UNVERIFIED. The OAuth flow and the endpoint paths below
 * come from Tredict's published OAuth2 docs, but the JSON body of a REST
 * activity is not documented publicly — the shapes here are inferred from what
 * the Tredict MCP server returns (a CSV with `summary.*` columns). Everything
 * that touches those field names is funnelled through `normalizeTredictActivity`
 * so that, the first time a real payload arrives, one function needs fixing and
 * nothing else. Do not spread raw Tredict fields through the app.
 *
 * Docs: https://www.tredict.com/blog/oauth_docs/
 */
import { signState, verifyState } from "./oauth-state";

const AUTH_URL = "https://www.tredict.com/authorization/";
const TOKEN_URL = "https://www.tredict.com/user/oauth/v2/token";
const API_BASE = "https://www.tredict.com/api/oauth/v2";

/** Read-only: we import training, we never write to the athlete's Tredict.
 *  `bodyvaluesRead` is what should expose capacity/zones — pending confirmation
 *  from Tredict, hence configurable rather than hard-coded. */
const DEFAULT_SCOPE = "activityRead bodyvaluesRead";

export function tredictConfigured(): boolean {
  return !!(
    process.env.TREDICT_CLIENT_ID &&
    process.env.TREDICT_CLIENT_SECRET &&
    process.env.TREDICT_STATE_SECRET &&
    process.env.NEXT_PUBLIC_APP_URL
  );
}

// ─── State ────────────────────────────────────────────────────────────────────

export const signTredictState = (uid: string) =>
  signState(uid, process.env.TREDICT_STATE_SECRET!);

export const verifyTredictState = (state: string) =>
  verifyState(state, process.env.TREDICT_STATE_SECRET!);

// ─── OAuth ────────────────────────────────────────────────────────────────────

export const tredictRedirectUri = () =>
  `${process.env.NEXT_PUBLIC_APP_URL}/api/tredict/callback`;

export function tredictAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.TREDICT_CLIENT_ID!,
    redirect_uri: tredictRedirectUri(),
    response_type: "code",
    scope: process.env.TREDICT_SCOPE ?? DEFAULT_SCOPE,
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export interface TredictTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
}

/** Tredict follows the OAuth2 spec, so the token endpoint takes
 *  `application/x-www-form-urlencoded` (Strava's JSON body is the odd one out). */
async function tokenRequest(body: Record<string, string>): Promise<TredictTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TREDICT_CLIENT_ID!,
      client_secret: process.env.TREDICT_CLIENT_SECRET!,
      ...body,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Tredict token request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Tredict token response missing access_token/refresh_token");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    // expires_in is seconds from now (spec). Tredict issues ~2 days.
    expiresAt: Date.now() + (Number(data.expires_in) || 172_800) * 1000,
    scope: data.scope,
  };
}

export const exchangeTredictCode = (code: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: tredictRedirectUri() });

export const refreshTredictToken = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

// ─── Activities ───────────────────────────────────────────────────────────────

/** What the app consumes. Deliberately close to the Strava-derived shape the
 *  log form already understands, so the import UI stays one component. */
export interface TredictActivity {
  id: string;
  /** ISO start date. */
  date: string;
  title: string;
  notes?: string;
  sportType: string;
  subSportType?: string;
  /** Seconds (moving/active duration). */
  durationSec: number;
  /** Metres. */
  distanceM: number;
  /** Seconds per kilometre — Tredict's native pace unit. */
  paceSecPerKm?: number;
  avgHeartrate?: number;
  maxHeartrate?: number;
  avgPower?: number;
  avgCadence?: number;
  calories?: number;
  elevationGainM?: number;
}

/** Raw payload, typed loosely on purpose: see the field-mapping warning above. */
type RawActivity = Record<string, unknown>;

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** Read `a.summary.pace` whether the payload nests it or flattens it to
 *  `"summary.pace"` (the MCP's CSV uses the flattened form). */
function summaryField(a: RawActivity, key: string): unknown {
  const flat = a[`summary.${key}`];
  if (flat !== undefined) return flat;
  const summary = a.summary;
  if (summary && typeof summary === "object") {
    return (summary as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * The single place Tredict's field names are read. Pure and unit-tested, so
 * correcting it against the real payload is a one-function change.
 */
export function normalizeTredictActivity(a: RawActivity): TredictActivity | null {
  const id = typeof a.id === "string" ? a.id : undefined;
  const date = typeof a.date === "string" ? a.date : undefined;
  // Without an id or a date the activity can't be referenced or placed on a
  // calendar; importing it would create a log we can't reconcile.
  if (!id || !date) return null;

  const speed = num(summaryField(a, "speed")); // m/s
  const pace = num(summaryField(a, "pace"));   // s/km

  return {
    id,
    date,
    title: typeof a.title === "string" && a.title ? a.title : "Attività Tredict",
    notes: typeof a.notes === "string" ? a.notes : undefined,
    sportType: typeof a.sportType === "string" ? a.sportType : "misc",
    subSportType: typeof a.subSportType === "string" ? a.subSportType : undefined,
    durationSec: num(summaryField(a, "duration")) ?? num(summaryField(a, "durationTotal")) ?? 0,
    distanceM: num(summaryField(a, "distance")) ?? 0,
    // Prefer the reported pace; fall back to deriving it from speed so a
    // payload carrying only one of the two still yields a usable pace.
    paceSecPerKm: pace ?? (speed && speed > 0 ? Math.round(1000 / speed) : undefined),
    avgHeartrate: num(summaryField(a, "heartrate")),
    maxHeartrate: num(summaryField(a, "heartrateMax")),
    avgPower: num(summaryField(a, "power")),
    avgCadence: num(summaryField(a, "cadence")),
    calories: num(summaryField(a, "calories")),
    elevationGainM: num(summaryField(a, "altitude.ascent")),
  };
}

async function apiGet(accessToken: string, path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 429) throw new Error("Tredict rate limit (429)");
  if (!res.ok) throw new Error(`Tredict API ${path} failed: ${res.status}`);
  return res.json();
}

/** Recent activities, newest first. */
export async function fetchTredictActivities(
  accessToken: string,
  pageSize = 10
): Promise<TredictActivity[]> {
  const data = await apiGet(accessToken, `/activityList?pageSize=${pageSize}`);
  // The list may come back bare or wrapped — accept both rather than guess.
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { activityList?: unknown })?.activityList)
    ? (data as { activityList: RawActivity[] }).activityList
    : [];
  return (list as RawActivity[])
    .map(normalizeTredictActivity)
    .filter((a): a is TredictActivity => a !== null);
}

/** One activity with its time series (`allSeries=1`), for deep analysis. */
export async function fetchTredictActivity(
  accessToken: string,
  activityId: string,
  withSeries = false
): Promise<unknown> {
  return apiGet(
    accessToken,
    `/activity/${encodeURIComponent(activityId)}${withSeries ? "?allSeries=1" : ""}`
  );
}

// ─── Unit helpers ─────────────────────────────────────────────────────────────

/** Tredict's seconds-per-km → "4:35". */
export function paceToString(secPerKm?: number): string {
  if (!secPerKm || secPerKm <= 0) return "";
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  // 4:60 is not a pace — carry the rounding into the minutes.
  return secs === 60 ? `${mins + 1}:00` : `${mins}:${String(secs).padStart(2, "0")}`;
}
