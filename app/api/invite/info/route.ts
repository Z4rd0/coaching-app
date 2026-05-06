import { NextRequest, NextResponse } from "next/server";
import { getDoc, doc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const coachId = searchParams.get("coach");

  if (!token || !coachId) {
    return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
  }

  try {
    const db = getFirebaseDb();
    const inviteSnap = await getDoc(doc(db, "coaches", coachId, "invites", token));
    if (!inviteSnap.exists()) {
      return NextResponse.json({ error: "Non trovato" }, { status: 404 });
    }
    const invite = inviteSnap.data();
    return NextResponse.json({
      coachName: invite.coachName ?? "",
      email: invite.email ?? "",
      status: invite.status,
    });
  } catch {
    return NextResponse.json({ error: "Errore" }, { status: 500 });
  }
}
