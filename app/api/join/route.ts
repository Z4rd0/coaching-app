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
    const projectId = (db as unknown as { _settings?: { projectId?: string } })._settings?.projectId
      ?? process.env.FIREBASE_PROJECT_ID
      ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const [coachSnap, athleteSnap] = await Promise.all([
      db.doc(`coaches/${coachId}`).get(),
      db.doc(`coaches/${coachId}/athletes/${athleteId}`).get(),
    ]);

    if (!coachSnap.exists || !athleteSnap.exists) {
      return NextResponse.json({
        error: "Not found",
        debug: {
          projectId,
          coachId,
          athleteId,
          coachExists: coachSnap.exists,
          athleteExists: athleteSnap.exists,
        },
      }, { status: 404 });
    }

    const athlete = athleteSnap.data()!;
    if (athlete.status !== "pending") {
      return NextResponse.json({ error: "already_used", status: athlete.status }, { status: 410 });
    }

    return NextResponse.json({
      coachName: coachSnap.data()?.name ?? "",
      athleteName: athlete.name ?? "",
      athleteEmail: athlete.email ?? "",
    });
  } catch (err) {
    console.error("join/info error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Server error", message }, { status: 500 });
  }
}
