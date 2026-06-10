import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyRequestAuth } from "@/lib/server-auth";
import { resolveLogContext } from "@/lib/log-auth";

/**
 * POST /api/delete-log — Body: { logId, athleteId? }
 * Auth: coach owns the log, or athlete owns it (resolved from athleteAccess).
 *
 * Removes the log and cascades to every group feed where the log was shared,
 * adjusting leaderboard stats accordingly. We read the feed entry's stored
 * duration when decrementing (not the log's current duration) so the
 * accounting stays correct even if the log was edited after sharing.
 */
export async function POST(req: NextRequest) {
  try {
    const { logId, athleteId: athleteIdHint } = await req.json();
    if (!logId) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    const caller = await verifyRequestAuth(req);
    if (!caller) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const ctx = await resolveLogContext(caller.uid, athleteIdHint);
    if (!ctx) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const db = getAdminDb();
    const logRef = db.doc(
      `coaches/${ctx.coachId}/athletes/${ctx.athleteId}/logs/${logId}`
    );
    const logSnap = await logRef.get();
    if (!logSnap.exists) {
      return NextResponse.json({ error: "Log non trovato" }, { status: 404 });
    }

    // Cascade to group feed + leaderboard stats
    if (ctx.athleteUid) {
      const groupsSnap = await db
        .collection(`coaches/${ctx.coachId}/groups`)
        .where("memberUids", "array-contains", ctx.athleteUid)
        .get();

      await Promise.all(
        groupsSnap.docs.map(async (g) => {
          const feedRef = g.ref.collection("feed").doc(logId);
          const feedSnap = await feedRef.get();
          if (!feedSnap.exists) return;
          const entry = feedSnap.data()!;
          const minutes = typeof entry.actualDurationMin === "number" ? entry.actualDurationMin : 0;
          await feedRef.delete();
          await g.ref.update({
            [`stats.${ctx.athleteUid}.sessions`]: FieldValue.increment(-1),
            [`stats.${ctx.athleteUid}.minutes`]: FieldValue.increment(-minutes),
          });
        })
      );
    }

    await logRef.delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("delete-log error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
