import { NextRequest, NextResponse } from "next/server";
import {
  adminGetInvite,
  adminGetAthlete,
  adminActivateAthlete,
  adminUpdateInviteStatus,
  adminSyncGroupMembership,
} from "@/lib/firestore-admin";
import { verifyRequestAuth } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const { token, coachId, name, email } = await req.json();

    if (!token || !coachId) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    // The activating uid comes from the verified token, never from the body
    const caller = await verifyRequestAuth(req);
    if (!caller) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const athleteUid = caller.uid;

    // 1. Fetch and validate the invite
    const invite = await adminGetInvite(coachId, token);
    if (!invite) {
      return NextResponse.json({ error: "Invito non trovato" }, { status: 404 });
    }
    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invito già usato o scaduto" }, { status: 400 });
    }
    if (invite.expiresAt.toMillis() < Date.now()) {
      await adminUpdateInviteStatus(coachId, token, "expired");
      return NextResponse.json({ error: "Invito scaduto" }, { status: 400 });
    }

    // 2. Get athlete profile
    const athlete = await adminGetAthlete(coachId, invite.athleteId);
    if (!athlete) {
      return NextResponse.json({ error: "Profilo atleta non trovato" }, { status: 404 });
    }

    // 3. Link athlete UID + create athleteAccess doc
    await adminActivateAthlete(
      coachId,
      invite.athleteId,
      athleteUid,
      name ?? athlete.name,
      email ?? athlete.email
    );

    // 4. If the athlete was pre-added to groups, authorize their access
    await adminSyncGroupMembership(coachId, invite.athleteId, athleteUid);

    // 5. Mark invite as accepted
    await adminUpdateInviteStatus(coachId, token, "accepted");

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
