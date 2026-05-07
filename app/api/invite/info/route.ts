import { NextRequest, NextResponse } from "next/server";
import { adminGetInvite } from "@/lib/firestore-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const coachId = searchParams.get("coach");

  if (!token || !coachId) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  try {
    const invite = await adminGetInvite(coachId, token);
    if (!invite) {
      return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    }
    return NextResponse.json({
      coachName: invite.coachName ?? "",
      email: invite.email ?? "",
      status: invite.status,
    });
  } catch {
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}
