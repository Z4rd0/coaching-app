import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyRequestAuth } from "@/lib/server-auth";

/**
 * POST /api/delete-group — Body: { groupId }
 * Coach-only (coachId = token uid). Recursively deletes the group doc with
 * its programs + feed subcollections — the previous client-side loop broke
 * down once the feed grew past a few hundred entries.
 */
export async function POST(req: NextRequest) {
  try {
    const { groupId } = await req.json();
    if (!groupId) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    const caller = await verifyRequestAuth(req);
    if (!caller) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const db = getAdminDb();
    const groupRef = db.doc(`coaches/${caller.uid}/groups/${groupId}`);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      return NextResponse.json({ error: "Gruppo non trovato" }, { status: 404 });
    }

    await db.recursiveDelete(groupRef);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("delete-group error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
