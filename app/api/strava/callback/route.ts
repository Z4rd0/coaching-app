import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyStravaState, exchangeStravaCode } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/athlete/dashboard?strava=denied`);
  }

  const uid = verifyStravaState(state);
  if (!uid) {
    return NextResponse.redirect(`${appUrl}/athlete/dashboard?strava=error`);
  }

  try {
    const tokens = await exchangeStravaCode(code);
    await getAdminDb()
      .collection("athleteAccess")
      .doc(uid)
      .update({
        strava: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          athleteId: tokens.athleteId,
        },
      });
    return NextResponse.redirect(`${appUrl}/athlete/dashboard?strava=connected`);
  } catch {
    return NextResponse.redirect(`${appUrl}/athlete/dashboard?strava=error`);
  }
}
