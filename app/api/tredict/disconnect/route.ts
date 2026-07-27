import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/server-auth";
import { disconnectTredict } from "@/lib/tredict-tokens";

/** POST /api/tredict/disconnect — forget our copy of the athlete's tokens.
 *  Tredict's refresh token never expires, so without this the only way out
 *  would be revoking inside Tredict itself. */
export async function POST(req: NextRequest) {
  const caller = await verifyRequestAuth(req);
  if (!caller) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  await disconnectTredict(caller.uid);
  return NextResponse.json({ success: true });
}
