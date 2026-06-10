import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyRequestAuth } from "@/lib/server-auth";

/**
 * POST /api/delete-athlete — Body: { athleteId }
 * Coach-only (coachId = token uid). Firestore doesn't cascade deletes, so:
 * 1. removes the athlete from every group (memberIds/memberUids/stats)
 * 2. deletes their athleteAccess lookup doc
 * 3. recursively deletes the athlete doc with logs + programs subcollections
 */
export async function POST(req: NextRequest) {
  try {
    const { athleteId } = await req.json();
    if (!athleteId) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    const caller = await verifyRequestAuth(req);
    if (!caller) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const coachId = caller.uid;

    const db = getAdminDb();
    const athleteRef = db.doc(`coaches/${coachId}/athletes/${athleteId}`);
    const athleteSnap = await athleteRef.get();
    if (!athleteSnap.exists) {
      return NextResponse.json({ error: "Atleta non trovato" }, { status: 404 });
    }
    const athleteUid: string | undefined = athleteSnap.data()?.athleteUid;

    // 1. Remove from groups (membership + leaderboard stats)
    const groupsSnap = await db
      .collection(`coaches/${coachId}/groups`)
      .where("memberIds", "array-contains", athleteId)
      .get();
    await Promise.all(
      groupsSnap.docs.map((g) =>
        g.ref.update({
          memberIds: FieldValue.arrayRemove(athleteId),
          ...(athleteUid
            ? {
                memberUids: FieldValue.arrayRemove(athleteUid),
                [`stats.${athleteUid}`]: FieldValue.delete(),
              }
            : {}),
        })
      )
    );

    // 2. Drop the access doc (only if it still points to this coach/athlete)
    if (athleteUid) {
      const accessRef = db.doc(`athleteAccess/${athleteUid}`);
      const accessSnap = await accessRef.get();
      if (
        accessSnap.exists &&
        accessSnap.data()?.coachId === coachId &&
        accessSnap.data()?.athleteId === athleteId
      ) {
        await accessRef.delete();
      }
    }

    // 3. Recursive delete: athlete doc + logs + programs subcollections
    await db.recursiveDelete(athleteRef);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("delete-athlete error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
