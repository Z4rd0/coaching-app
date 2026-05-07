/**
 * Firestore helpers for server-side API routes (Firebase Admin SDK).
 * Mirror of lib/firestore.ts but runs with admin privileges.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "./firebase-admin";
import type { Coach, Athlete, AthleteAccess, Invite } from "@/types";

const db = () => getAdminDb();

// ─── Paths ────────────────────────────────────────────────────────────────────

const coachDoc = (coachId: string) => db().collection("coaches").doc(coachId);
const athleteDoc = (coachId: string, athleteId: string) =>
  coachDoc(coachId).collection("athletes").doc(athleteId);
const inviteDoc = (coachId: string, inviteId: string) =>
  coachDoc(coachId).collection("invites").doc(inviteId);
const athleteAccessDoc = (athleteUid: string) =>
  db().collection("athleteAccess").doc(athleteUid);

// ─── Coach ────────────────────────────────────────────────────────────────────

export async function adminGetCoach(coachId: string): Promise<Coach | null> {
  const snap = await coachDoc(coachId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Coach;
}

// ─── Athletes ─────────────────────────────────────────────────────────────────

export async function adminCreateAthlete(
  coachId: string,
  data: Omit<Athlete, "id" | "createdAt">
): Promise<string> {
  const ref = await coachDoc(coachId).collection("athletes").add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function adminGetAthlete(
  coachId: string,
  athleteId: string
): Promise<Athlete | null> {
  const snap = await athleteDoc(coachId, athleteId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Athlete;
}

export async function adminActivateAthlete(
  coachId: string,
  athleteId: string,
  athleteUid: string,
  name: string,
  email: string
): Promise<void> {
  await athleteDoc(coachId, athleteId).update({
    athleteUid,
    status: "active",
  });
  const access: AthleteAccess = { coachId, athleteId, name, email };
  await athleteAccessDoc(athleteUid).set(access);
}

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function adminCreateInvite(
  coachId: string,
  data: Omit<Invite, "id" | "createdAt" | "expiresAt">
): Promise<string> {
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const ref = await coachDoc(coachId).collection("invites").add({
    ...data,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });
  return ref.id;
}

export async function adminGetInvite(
  coachId: string,
  inviteId: string
): Promise<(Invite & { _ref: FirebaseFirestore.DocumentReference }) | null> {
  const snap = await inviteDoc(coachId, inviteId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data(), _ref: snap.ref } as Invite & {
    _ref: FirebaseFirestore.DocumentReference;
  };
}

export async function adminUpdateInviteStatus(
  coachId: string,
  inviteId: string,
  status: Invite["status"]
): Promise<void> {
  await inviteDoc(coachId, inviteId).update({ status });
}
