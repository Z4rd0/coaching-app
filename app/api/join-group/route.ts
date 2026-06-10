import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyRequestAuth } from "@/lib/server-auth";

/**
 * GET /api/join-group?coachId=...&groupId=...
 * Public info for the group invite landing page.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coachId = searchParams.get("coachId");
  const groupId = searchParams.get("groupId");

  if (!coachId || !groupId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const [coachSnap, groupSnap] = await Promise.all([
      db.doc(`coaches/${coachId}`).get(),
      db.doc(`coaches/${coachId}/groups/${groupId}`).get(),
    ]);

    if (!groupSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const group = groupSnap.data()!;
    return NextResponse.json({
      coachName: coachSnap.data()?.name ?? "Coach",
      groupName: group.name ?? "Gruppo",
      sport: group.sport ?? "",
      memberCount: (group.memberIds ?? []).length,
    });
  } catch (err) {
    console.error("join-group/info error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/join-group
 * Body: { coachId, groupId, name?, email? } — uid taken from the verified ID token
 *
 * Adds an authenticated user to a group:
 * - already an athlete of this coach → reuses their profile
 * - athlete of another coach → rejected (an account can be linked to one coach)
 * - coach account → rejected
 * - brand-new user → creates athlete profile + athleteAccess, then joins
 * Runs with the Admin SDK: group membership writes are coach-only in the rules.
 */
export async function POST(req: NextRequest) {
  try {
    const { coachId, groupId, name, email } = await req.json();

    if (!coachId || !groupId) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    // The joining uid comes from the verified token, never from the body
    const caller = await verifyRequestAuth(req);
    if (!caller) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const uid = caller.uid;

    const db = getAdminDb();
    const groupRef = db.doc(`coaches/${coachId}/groups/${groupId}`);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      return NextResponse.json({ error: "Gruppo non trovato" }, { status: 404 });
    }
    const group = groupSnap.data()!;

    // Resolve (or create) the athlete profile for this auth user
    let athleteId: string;
    const accessSnap = await db.doc(`athleteAccess/${uid}`).get();

    if (accessSnap.exists) {
      const access = accessSnap.data()!;
      if (access.coachId !== coachId) {
        return NextResponse.json(
          { error: "OTHER_COACH" },
          { status: 409 }
        );
      }
      athleteId = access.athleteId;
    } else {
      const coachSnap = await db.doc(`coaches/${uid}`).get();
      if (coachSnap.exists) {
        return NextResponse.json(
          { error: uid === coachId ? "OWN_GROUP" : "IS_COACH" },
          { status: 409 }
        );
      }

      const safeEmail = caller.email ?? email ?? "";
      const displayName =
        (name ?? "").trim() || caller.name || safeEmail.split("@")[0] || "Atleta";
      const athleteRef = await db.collection(`coaches/${coachId}/athletes`).add({
        name: displayName,
        email: safeEmail,
        sport: group.sport ?? "",
        goals: "",
        notes: "",
        athleteUid: uid,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
      });
      athleteId = athleteRef.id;

      await db.doc(`athleteAccess/${uid}`).set({
        coachId,
        athleteId,
        name: displayName,
        email: safeEmail,
      });
    }

    // Join the group (idempotent — re-joining is harmless)
    await groupRef.update({
      memberIds: FieldValue.arrayUnion(athleteId),
      memberUids: FieldValue.arrayUnion(uid),
    });

    return NextResponse.json({
      success: true,
      groupName: group.name ?? "Gruppo",
      athleteId,
    });
  } catch (err) {
    console.error("join-group error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
