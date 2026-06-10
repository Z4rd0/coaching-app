import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { verifyRequestAuth } from "@/lib/server-auth";
import { resolveLogContext } from "@/lib/log-auth";

/**
 * POST /api/update-log — Body: { logId, athleteId?, patch }
 * Auth: coach owns the log, or athlete owns it.
 *
 * Edits a whitelist of metadata fields (date, duration, RPE, mood/energy,
 * notes). Exercise/cardio/HIIT detail is intentionally NOT editable here —
 * fixing those would be re-logging the workout. When the duration changes,
 * we update the group feed entries and adjust leaderboard minutes by the
 * delta so the classifica stays consistent.
 */
const EDITABLE_FIELDS = [
  "actualDurationMin",
  "perceivedRPE",
  "mood",
  "energyLevel",
  "notes",
] as const;

export async function POST(req: NextRequest) {
  try {
    const { logId, athleteId: athleteIdHint, patch } = await req.json();
    if (!logId || !patch || typeof patch !== "object") {
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
    const oldLog = logSnap.data()!;

    // Build the sanitized update
    const update: Record<string, unknown> = {};
    for (const k of EDITABLE_FIELDS) {
      if (k in patch) update[k] = patch[k];
    }
    // Date can come as "YYYY-MM-DD" — store as Timestamp at noon to avoid TZ drift
    if (typeof patch.dateISO === "string" && /^\d{4}-\d{2}-\d{2}$/.test(patch.dateISO)) {
      update.date = Timestamp.fromDate(new Date(patch.dateISO + "T12:00:00"));
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Niente da aggiornare" }, { status: 400 });
    }

    await logRef.update(update);

    // Sync the group feed if the log was shared
    if (ctx.athleteUid) {
      const groupsSnap = await db
        .collection(`coaches/${ctx.coachId}/groups`)
        .where("memberUids", "array-contains", ctx.athleteUid)
        .get();

      const newDuration =
        typeof update.actualDurationMin === "number"
          ? update.actualDurationMin
          : (oldLog.actualDurationMin as number | undefined);
      const newRPE =
        typeof update.perceivedRPE === "number"
          ? update.perceivedRPE
          : oldLog.perceivedRPE;
      const newDate = (update.date as Timestamp | undefined) ?? oldLog.date;

      await Promise.all(
        groupsSnap.docs.map(async (g) => {
          const feedRef = g.ref.collection("feed").doc(logId);
          const feedSnap = await feedRef.get();
          if (!feedSnap.exists) return;
          const oldMinutes = (feedSnap.data()?.actualDurationMin as number | undefined) ?? 0;
          const deltaMinutes = (newDuration ?? oldMinutes) - oldMinutes;
          await feedRef.update({
            ...(typeof newDuration === "number" ? { actualDurationMin: newDuration } : {}),
            ...(typeof newRPE === "number" ? { perceivedRPE: newRPE } : {}),
            ...(newDate ? { date: newDate } : {}),
          });
          if (deltaMinutes !== 0 && ctx.athleteUid) {
            await g.ref.update({
              [`stats.${ctx.athleteUid}.minutes`]: FieldValue.increment(deltaMinutes),
            });
          }
        })
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("update-log error:", err);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
