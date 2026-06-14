import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/server-auth";
import { signStravaState, stravaAuthUrl } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const caller = await verifyRequestAuth(req);
  if (!caller) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_STATE_SECRET) {
    return NextResponse.json({ error: "Strava non configurato" }, { status: 503 });
  }

  const state = signStravaState(caller.uid);
  return NextResponse.json({ url: stravaAuthUrl(state) });
}
