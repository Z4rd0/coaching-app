import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/server-auth";
import { signTredictState, tredictAuthUrl, tredictConfigured } from "@/lib/tredict";

export async function GET(req: NextRequest) {
  const caller = await verifyRequestAuth(req);
  if (!caller) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  if (!tredictConfigured()) {
    return NextResponse.json({ error: "Tredict non configurato" }, { status: 503 });
  }
  return NextResponse.json({ url: tredictAuthUrl(signTredictState(caller.uid)) });
}
