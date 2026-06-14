import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyRequestAuth } from "@/lib/server-auth";
import { refreshStravaToken, fetchStravaLaps, speedToPace } from "@/lib/strava";
import type { Lap } from "@/types";

export async function GET(req: NextRequest) {
  const caller = await verifyRequestAuth(req);
  if (!caller) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const activityId = req.nextUrl.searchParams.get("activityId");
  if (!activityId || isNaN(Number(activityId))) {
    return NextResponse.json({ error: "activityId mancante" }, { status: 400 });
  }

  const doc = await getAdminDb().collection("athleteAccess").doc(caller.uid).get();
  const data = doc.data() as Record<string, unknown> | undefined;
  const strava = data?.strava as
    | { accessToken: string; refreshToken: string; expiresAt: number }
    | undefined;

  if (!strava) {
    return NextResponse.json({ error: "Strava non connesso" }, { status: 404 });
  }

  let { accessToken, refreshToken, expiresAt } = strava;

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
    const rawLaps = await fetchStravaLaps(accessToken, Number(activityId));

    const laps: Lap[] = rawLaps.map((l) => ({
      index: l.lap_index,
      distanceM: Math.round(l.distance),
      elapsedSec: l.elapsed_time,
      ...(l.average_speed ? { avgPaceMinPerKm: speedToPace(l.average_speed) } : {}),
      ...(l.average_heartrate ? { avgHR: Math.round(l.average_heartrate) } : {}),
      ...(l.max_heartrate ? { maxHR: Math.round(l.max_heartrate) } : {}),
      ...(l.average_cadence ? { avgCadence: Math.round(l.average_cadence) } : {}),
    }));

    return NextResponse.json({ laps });
  } catch {
    return NextResponse.json({ error: "Errore Strava API" }, { status: 502 });
  }
}
