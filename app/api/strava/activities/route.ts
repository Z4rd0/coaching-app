import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyRequestAuth } from "@/lib/server-auth";
import { refreshStravaToken, fetchStravaActivities } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const caller = await verifyRequestAuth(req);
  if (!caller) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const doc = await getAdminDb().collection("athleteAccess").doc(caller.uid).get();
  const data = doc.data() as Record<string, unknown> | undefined;
  const strava = data?.strava as
    | { accessToken: string; refreshToken: string; expiresAt: number; athleteId: number }
    | undefined;

  if (!strava) {
    return NextResponse.json({ error: "Strava non connesso" }, { status: 404 });
  }

  let { accessToken, refreshToken, expiresAt } = strava;

  // Refresh if the token expires within the next minute
  if (Date.now() > expiresAt - 60_000) {
    try {
      const refreshed = await refreshStravaToken(refreshToken);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;
      expiresAt = refreshed.expiresAt;
      await getAdminDb()
        .collection("athleteAccess")
        .doc(caller.uid)
        .update({
          "strava.accessToken": accessToken,
          "strava.refreshToken": refreshToken,
          "strava.expiresAt": expiresAt,
        });
    } catch {
      return NextResponse.json({ error: "Impossibile rinnovare il token Strava" }, { status: 502 });
    }
  }

  try {
    const activities = await fetchStravaActivities(accessToken, 10);
    return NextResponse.json({ activities });
  } catch {
    return NextResponse.json({ error: "Errore Strava API" }, { status: 502 });
  }
}
