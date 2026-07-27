import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/server-auth";
import { refreshTredictToken, fetchTredictActivities } from "@/lib/tredict";
import { getTredictTokens, updateTredictTokens } from "@/lib/tredict-tokens";

/**
 * GET /api/tredict/activities — the caller's recent Tredict activities.
 *
 * 404 means "not connected" and is expected: the log form uses it to show a
 * connect prompt inline (see the Strava equivalent — a redirect there used to
 * throw away a half-filled form).
 */
export async function GET(req: NextRequest) {
  const caller = await verifyRequestAuth(req);
  if (!caller) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const stored = await getTredictTokens(caller.uid);
  if (!stored) {
    return NextResponse.json({ error: "Tredict non connesso" }, { status: 404 });
  }

  let { accessToken } = stored;

  // Access tokens last ~2 days; refresh a minute before expiry.
  if (Date.now() > stored.expiresAt - 60_000) {
    try {
      const refreshed = await refreshTredictToken(stored.refreshToken);
      accessToken = refreshed.accessToken;
      await updateTredictTokens(caller.uid, refreshed);
    } catch (err) {
      console.error("tredict refresh error:", err);
      return NextResponse.json(
        { error: "Impossibile rinnovare il token Tredict" },
        { status: 502 }
      );
    }
  }

  try {
    const activities = await fetchTredictActivities(accessToken, 10);
    return NextResponse.json({ activities });
  } catch (err) {
    console.error("tredict activities error:", err);
    return NextResponse.json({ error: "Errore Tredict API" }, { status: 502 });
  }
}
