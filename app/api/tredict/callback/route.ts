import { NextRequest, NextResponse } from "next/server";
import { verifyTredictState, exchangeTredictCode } from "@/lib/tredict";
import { saveTredictTokens } from "@/lib/tredict-tokens";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/athlete/dashboard?tredict=denied`);
  }

  // The uid comes from the signed state, never from the query string.
  const uid = verifyTredictState(state);
  if (!uid) {
    return NextResponse.redirect(`${appUrl}/athlete/dashboard?tredict=error`);
  }

  try {
    const tokens = await exchangeTredictCode(code);
    await saveTredictTokens(uid, tokens);
    return NextResponse.redirect(`${appUrl}/athlete/dashboard?tredict=connected`);
  } catch (err) {
    console.error("tredict callback error:", err);
    return NextResponse.redirect(`${appUrl}/athlete/dashboard?tredict=error`);
  }
}
