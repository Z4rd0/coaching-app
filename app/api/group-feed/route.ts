import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyRequestAuth } from "@/lib/server-auth";

/**
 * POST /api/group-feed
 * Body: { logId } — uid from the verified ID token.
 *
 * Shares a saved workout log with every group the athlete belongs to and
 * updates the per-member aggregate stats used by the leaderboard.
 * The feed entry is built server-side FROM THE LOG DOC (source of truth),
 * so clients can't inflate durations or fabricate entries. Feed doc id =
 * logId → sharing is idempotent (re-posting the same log is a no-op).
 */
export async function POST(req: NextRequest) {
  try {
    const { logId } = await req.json();
    if (!logId) {
      return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
    }

    const caller = await verifyRequestAuth(req);
    if (!caller) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const db = getAdminDb();
    const accessSnap = await db.doc(`athleteAccess/${caller.uid}`).get();
    if (!accessSnap.exists) {
      return NextResponse.json({ error: "Non sei un atleta" }, { status: 403 });
    }
    const { coachId, athleteId, name } = accessSnap.data()!;

    const logSnap = await db
      .doc(`coaches/${coachId}/athletes/${athleteId}/logs/${logId}`)
      .get();
    if (!logSnap.exists) {
      return NextResponse.json({ error: "Log non trovato" }, { status: 404 });
    }
    const log = logSnap.data()!;

    const groupsSnap = await db
      .collection(`coaches/${coachId}/groups`)
      .where("memberUids", "array-contains", caller.uid)
      .get();
    if (groupsSnap.empty) {
      return NextResponse.json({ success: true, shared: 0 });
    }

    const sessionType =
      log.plannedSession?.type ??
      (log.circuitLog ? "circuit" : log.cardioLog ? "cardio" : "strength");
    const durationMin = typeof log.actualDurationMin === "number" ? log.actualDurationMin : 0;

    const entry = {
      athleteId,
      athleteUid: caller.uid,
      athleteName: name ?? "Atleta",
      logId,
      date: log.date,
      ...(log.plannedSession?.title ? { sessionTitle: log.plannedSession.title } : {}),
      sessionType,
      actualDurationMin: durationMin,
      perceivedRPE: typeof log.perceivedRPE === "number" ? log.perceivedRPE : 0,
      createdAt: FieldValue.serverTimestamp(),
    };

    let shared = 0;
    await Promise.all(
      groupsSnap.docs.map(async (g) => {
        try {
          await g.ref.collection("feed").doc(logId).create(entry);
          await g.ref.update({
            [`stats.${caller.uid}.name`]: entry.athleteName,
            [`stats.${caller.uid}.sessions`]: FieldValue.increment(1),
            [`stats.${caller.uid}.minutes`]: FieldValue.increment(durationMin),
          });
          shared++;
        } catch {
          // create() failed → entry already exists for this log, skip increments
        }
      })
    );

    return NextResponse.json({ success: true, shared });
  } catch (err) {
    console.error("group-feed error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
