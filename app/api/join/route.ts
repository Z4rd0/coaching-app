import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

/**
 * GET /api/join?coachId=...&athleteId=...
 * Returns coach name + athlete name/email for the join page (no auth required).
 * Uses Admin SDK — safe to expose limited fields only.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coachId = searchParams.get("coachId");
  const athleteId = searchParams.get("athleteId");

  if (!coachId || !athleteId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const [coachSnap, athleteSnap] = await Promise.all([
      db.doc(`coaches/${coachId}`).get(),
      db.doc(`coaches/${coachId}/athletes/${athleteId}`).get(),
    ]);

    // The athlete doc is the source of truth for the join. The coach doc
    // is only used to display the coach's name — fall back gracefully
    // if it's missing (older accounts may not have one).
    if (!athleteSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const athlete = athleteSnap.data()!;
    const alreadyActive = athlete.status === "active";

    return NextResponse.json({
      coachName: coachSnap.data()?.name ?? "Coach",
      athleteName: athlete.name ?? "",
      athleteEmail: athlete.email ?? "",
      alreadyActive,
    });
  } catch (err) {
    console.error("join/info error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Server error", message }, { status: 500 });
  }
}
