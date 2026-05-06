import { NextRequest, NextResponse } from "next/server";
import {
  getDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
  getAthlete,
  activateAthlete,
  updateInviteStatus,
} from "@/lib/firestore";

export async function POST(req: NextRequest) {
  try {
    const { token, coachId, athleteUid, name, email } = await req.json();

    if (!token || !coachId || !athleteUid) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    // 1. Fetch and validate the invite
    const db = getFirebaseDb();
    const inviteSnap = await getDoc(doc(db, "coaches", coachId, "invites", token));

    if (!inviteSnap.exists()) {
      return NextResponse.json({ error: "Invito non trovato" }, { status: 404 });
    }

    const invite = inviteSnap.data();

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invito già usato o scaduto" }, { status: 400 });
    }

    const now = Timestamp.now();
    if (invite.expiresAt.toMillis() < now.toMillis()) {
      await updateInviteStatus(coachId, token, "expired");
      return NextResponse.json({ error: "Invito scaduto" }, { status: 400 });
    }

    // 2. Get athlete profile
    const athlete = await getAthlete(coachId, invite.athleteId);
    if (!athlete) {
      return NextResponse.json({ error: "Profilo atleta non trovato" }, { status: 404 });
    }

    // 3. Link athlete UID + create athleteAccess
    await activateAthlete(
      coachId,
      invite.athleteId,
      athleteUid,
      name ?? athlete.name,
      email ?? athlete.email
    );

    // 4. Mark invite as accepted
    await updateInviteStatus(coachId, token, "accepted");

    return NextResponse.json({
      success: true,
      coachId,
      athleteId: invite.athleteId,
      athleteName: athlete.name,
    });
  } catch (err) {
    console.error("invite/accept error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
