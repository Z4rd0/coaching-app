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
 * logId → sharing is idempotent (re-posting the same log is a no-op). Each
 * entry and its corresponding leaderboard increment commit together.
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

    const groupsSnap = await db
      .collection(`coaches/${coachId}/groups`)
      .where("memberUids", "array-contains", caller.uid)
      .get();
    if (groupsSnap.empty) {
      return NextResponse.json({ success: true, shared: 0 });
    }

    const logRef = db.doc(`coaches/${coachId}/athletes/${athleteId}/logs/${logId}`);
    const shared = await db.runTransaction(async (tx) => {
      const logSnap = await tx.get(logRef);
      if (!logSnap.exists) return null;

      const feedRefs = groupsSnap.docs.map((g) => g.ref.collection("feed").doc(logId));
      const feedSnaps = await Promise.all(feedRefs.map((ref) => tx.get(ref)));
      const log = logSnap.data()!;
      // Recorded on the log since M5. The plannedSession fallback and the
      // sub-log heuristic below only serve logs written before that.
      const sessionType =
        log.sessionType ??
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

      let created = 0;
      feedSnaps.forEach((feedSnap, index) => {
        if (feedSnap.exists) return;
        tx.create(feedRefs[index], entry);
        tx.update(groupsSnap.docs[index].ref, {
          [`stats.${caller.uid}.name`]: entry.athleteName,
          [`stats.${caller.uid}.sessions`]: FieldValue.increment(1),
          [`stats.${caller.uid}.minutes`]: FieldValue.increment(durationMin),
        });
        created++;
      });
      return created;
    });

    if (shared === null) {
      return NextResponse.json({ error: "Log non trovato" }, { status: 404 });
    }

    return NextResponse.json({ success: true, shared });
  } catch (err) {
    console.error("group-feed error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
