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

    if (!coachSnap.exists || !athleteSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const athlete = athleteSnap.data()!;
    if (athlete.status !== "pending") {
      return NextResponse.json({ error: "already_used" }, { status: 410 });
    }

    return NextResponse.json({
      coachName: coachSnap.data()?.name ?? "",
      athleteName: athlete.name ?? "",
      athleteEmail: athlete.email ?? "",
    });
  } catch (err) {
    console.error("join/info error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
