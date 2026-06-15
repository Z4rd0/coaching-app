import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentReference,
  arrayUnion,
  arrayRemove,
  getCountFromServer,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import type {
  Coach,
  Athlete,
  AthleteAccess,
  AthleteProgram,
  Group,
  GroupProgram,
  GroupFeedEntry,
  Invite,
  Program,
  WorkoutLog,
  Session,
} from "@/types";

const db = () => getFirebaseDb();

/**
 * Recursively strip `undefined` values from objects/arrays before writing
 * to Firestore — Firestore rejects documents containing `undefined` and
 * the resulting error message is opaque ("Function ... called with invalid data").
 * Preserves Timestamp instances, DocumentReference, Date, and other class
 * instances by only walking plain objects and arrays.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    // Preserve class instances (Timestamp, DocumentReference, Date, etc.)
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

// ─── Paths ────────────────────────────────────────────────────────────────────

export const coachRef = (coachId: string) =>
  doc(db(), "coaches", coachId);
export const athletesRef = (coachId: string) =>
  collection(db(), "coaches", coachId, "athletes");
export const athleteRef = (coachId: string, athleteId: string) =>
  doc(db(), "coaches", coachId, "athletes", athleteId);

// Coach library programs
export const programsRef = (coachId: string) =>
  collection(db(), "coaches", coachId, "programs");
export const programRef = (coachId: string, programId: string) =>
  doc(db(), "coaches", coachId, "programs", programId);

// Athlete-specific programs (personalized copies)
export const athleteProgramsRef = (coachId: string, athleteId: string) =>
  collection(db(), "coaches", coachId, "athletes", athleteId, "programs");
export const athleteProgramRef = (coachId: string, athleteId: string, programId: string) =>
  doc(db(), "coaches", coachId, "athletes", athleteId, "programs", programId);

// Logs
export const logsRef = (coachId: string, athleteId: string) =>
  collection(db(), "coaches", coachId, "athletes", athleteId, "logs");
export const logRef = (coachId: string, athleteId: string, logId: string) =>
  doc(db(), "coaches", coachId, "athletes", athleteId, "logs", logId);

// Invites
export const invitesRef = (coachId: string) =>
  collection(db(), "coaches", coachId, "invites");
export const inviteRef = (coachId: string, inviteId: string) =>
  doc(db(), "coaches", coachId, "invites", inviteId);

// Groups
export const groupsRef = (coachId: string) =>
  collection(db(), "coaches", coachId, "groups");
export const groupRef = (coachId: string, groupId: string) =>
  doc(db(), "coaches", coachId, "groups", groupId);

// Group programs (shared — single copy for all members)
export const groupProgramsRef = (coachId: string, groupId: string) =>
  collection(db(), "coaches", coachId, "groups", groupId, "programs");
export const groupProgramRef = (coachId: string, groupId: string, programId: string) =>
  doc(db(), "coaches", coachId, "groups", groupId, "programs", programId);

// Group feed (fase 2 — shared log entries for the "gara")
export const groupFeedRef = (coachId: string, groupId: string) =>
  collection(db(), "coaches", coachId, "groups", groupId, "feed");

// AthleteAccess — global lookup for security rules
export const athleteAccessRef = (athleteUid: string) =>
  doc(db(), "athleteAccess", athleteUid);

// ─── Coach ────────────────────────────────────────────────────────────────────

export async function getCoach(coachId: string): Promise<Coach | null> {
  const snap = await getDoc(coachRef(coachId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Coach;
}

export async function createCoach(uid: string, name: string, email: string): Promise<void> {
  await setDoc(coachRef(uid), {
    name,
    email,
    createdAt: Timestamp.now(),
    settings: {},
  });
}

// ─── Athletes (coach-managed profiles) ───────────────────────────────────────

export async function getAthletes(coachId: string): Promise<Athlete[]> {
  const snap = await getDocs(
    query(athletesRef(coachId), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Athlete));
}

export async function getAthlete(coachId: string, athleteId: string): Promise<Athlete | null> {
  const snap = await getDoc(athleteRef(coachId, athleteId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Athlete;
}

export async function createAthlete(
  coachId: string,
  data: Omit<Athlete, "id" | "createdAt">
): Promise<DocumentReference> {
  return addDoc(athletesRef(coachId), stripUndefined({
    ...data,
    createdAt: Timestamp.now(),
  }));
}

export async function updateAthlete(
  coachId: string,
  athleteId: string,
  data: Partial<Omit<Athlete, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(athleteRef(coachId, athleteId), stripUndefined(data));
}

/** Link Firebase Auth UID to athlete and create the global access document */
export async function activateAthlete(
  coachId: string,
  athleteId: string,
  athleteUid: string,
  name: string,
  email: string
): Promise<void> {
  await updateDoc(athleteRef(coachId, athleteId), {
    athleteUid,
    status: "active",
  });
  const access: Omit<AthleteAccess, never> = { coachId, athleteId, name, email };
  await setDoc(athleteAccessRef(athleteUid), access);
}

/** Lookup by Firebase Auth UID — used on athlete login to find their coach */
export async function getAthleteAccessByUid(uid: string): Promise<AthleteAccess | null> {
  const snap = await getDoc(athleteAccessRef(uid));
  if (!snap.exists()) return null;
  return snap.data() as AthleteAccess;
}

// ─── Invites ──────────────────────────────────────────────────────────────────

export async function createInvite(
  coachId: string,
  data: Omit<Invite, "id" | "createdAt" | "expiresAt">
): Promise<{ ref: DocumentReference; expiresAt: Timestamp }> {
  const expiresAt = Timestamp.fromDate(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  );
  const ref = await addDoc(invitesRef(coachId), {
    ...data,
    status: "pending",
    createdAt: Timestamp.now(),
    expiresAt,
  });
  return { ref, expiresAt };
}

export async function getInvitesByAthlete(
  coachId: string,
  athleteId: string
): Promise<Invite[]> {
  const snap = await getDocs(
    query(invitesRef(coachId), where("athleteId", "==", athleteId))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invite));
}

export async function updateInviteStatus(
  coachId: string,
  inviteId: string,
  status: Invite["status"]
): Promise<void> {
  await updateDoc(inviteRef(coachId, inviteId), { status });
}

// ─── Athlete Programs (personalized copies) ───────────────────────────────────

export async function getAthletePrograms(
  coachId: string,
  athleteId: string
): Promise<AthleteProgram[]> {
  const snap = await getDocs(
    query(athleteProgramsRef(coachId, athleteId), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AthleteProgram));
}

export async function getAthleteProgram(
  coachId: string,
  athleteId: string,
  programId: string
): Promise<AthleteProgram | null> {
  const snap = await getDoc(athleteProgramRef(coachId, athleteId, programId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AthleteProgram;
}

export async function createAthleteProgram(
  coachId: string,
  athleteId: string,
  data: Omit<AthleteProgram, "id" | "createdAt">
): Promise<DocumentReference> {
  return addDoc(athleteProgramsRef(coachId, athleteId), stripUndefined({
    ...data,
    createdAt: Timestamp.now(),
  }));
}

export async function updateAthleteProgram(
  coachId: string,
  athleteId: string,
  programId: string,
  data: Partial<Omit<AthleteProgram, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(athleteProgramRef(coachId, athleteId, programId), stripUndefined(data));
}

export async function deleteAthleteProgram(
  coachId: string,
  athleteId: string,
  programId: string
): Promise<void> {
  await deleteDoc(athleteProgramRef(coachId, athleteId, programId));
}

/** Copy a coach library program and assign it to an athlete */
export async function copyProgramToAthlete(
  coachId: string,
  athleteId: string,
  sourceProgram: Program
): Promise<DocumentReference> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt: _createdAt, ...rest } = sourceProgram;
  return createAthleteProgram(coachId, athleteId, {
    ...rest,
    sourceTemplateId: id,
    status: "active",
  });
}

export async function setActiveAthleteProgram(
  coachId: string,
  athleteId: string,
  programId: string
): Promise<void> {
  const all = await getDocs(athleteProgramsRef(coachId, athleteId));
  await Promise.all(all.docs.map((d) => updateDoc(d.ref, { isActive: false })));
  await updateDoc(athleteProgramRef(coachId, athleteId, programId), { isActive: true });
}

export async function getActiveAthleteProgram(
  coachId: string,
  athleteId: string
): Promise<AthleteProgram | null> {
  const snap = await getDocs(
    query(
      athleteProgramsRef(coachId, athleteId),
      where("isActive", "==", true),
      limit(1)
    )
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as AthleteProgram;
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export async function getGroups(coachId: string): Promise<Group[]> {
  const snap = await getDocs(
    query(groupsRef(coachId), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
}

export async function getGroup(coachId: string, groupId: string): Promise<Group | null> {
  const snap = await getDoc(groupRef(coachId, groupId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Group;
}

export async function createGroup(
  coachId: string,
  data: Omit<Group, "id" | "createdAt">
): Promise<DocumentReference> {
  return addDoc(groupsRef(coachId), stripUndefined({
    ...data,
    createdAt: Timestamp.now(),
  }));
}

export async function updateGroup(
  coachId: string,
  groupId: string,
  data: Partial<Omit<Group, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(groupRef(coachId, groupId), stripUndefined(data));
}

export async function addAthleteToGroup(
  coachId: string,
  groupId: string,
  athlete: Athlete
): Promise<void> {
  await updateDoc(groupRef(coachId, groupId), {
    memberIds: arrayUnion(athlete.id),
    // memberUids authorizes member reads via security rules — only active
    // athletes have an auth UID; pending ones are synced on invite accept
    ...(athlete.athleteUid ? { memberUids: arrayUnion(athlete.athleteUid) } : {}),
  });
}

export async function removeAthleteFromGroup(
  coachId: string,
  groupId: string,
  athlete: Athlete
): Promise<void> {
  await updateDoc(groupRef(coachId, groupId), {
    memberIds: arrayRemove(athlete.id),
    ...(athlete.athleteUid ? { memberUids: arrayRemove(athlete.athleteUid) } : {}),
  });
}

/** Athlete side: groups the logged-in athlete belongs to */
export async function getGroupsForAthlete(
  coachId: string,
  athleteUid: string
): Promise<Group[]> {
  const snap = await getDocs(
    query(groupsRef(coachId), where("memberUids", "array-contains", athleteUid))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Group));
}

// ─── Group Programs (shared) ──────────────────────────────────────────────────

export async function getGroupPrograms(
  coachId: string,
  groupId: string
): Promise<GroupProgram[]> {
  const snap = await getDocs(
    query(groupProgramsRef(coachId, groupId), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupProgram));
}

export async function getGroupProgram(
  coachId: string,
  groupId: string,
  programId: string
): Promise<GroupProgram | null> {
  const snap = await getDoc(groupProgramRef(coachId, groupId, programId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as GroupProgram;
}

export async function createGroupProgram(
  coachId: string,
  groupId: string,
  data: Omit<GroupProgram, "id" | "createdAt">
): Promise<DocumentReference> {
  return addDoc(groupProgramsRef(coachId, groupId), stripUndefined({
    ...data,
    createdAt: Timestamp.now(),
  }));
}

export async function updateGroupProgram(
  coachId: string,
  groupId: string,
  programId: string,
  data: Partial<Omit<GroupProgram, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(groupProgramRef(coachId, groupId, programId), stripUndefined(data));
}

export async function deleteGroupProgram(
  coachId: string,
  groupId: string,
  programId: string
): Promise<void> {
  await deleteDoc(groupProgramRef(coachId, groupId, programId));
}

/** Copy a coach library program into a group (shared — not per-athlete) */
export async function copyProgramToGroup(
  coachId: string,
  groupId: string,
  sourceProgram: Program
): Promise<DocumentReference> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, createdAt: _createdAt, ...rest } = sourceProgram;
  return createGroupProgram(coachId, groupId, {
    ...rest,
    sourceTemplateId: id,
    status: "active",
  });
}

export async function setActiveGroupProgram(
  coachId: string,
  groupId: string,
  programId: string
): Promise<void> {
  const all = await getDocs(groupProgramsRef(coachId, groupId));
  await Promise.all(all.docs.map((d) => updateDoc(d.ref, { isActive: false })));
  await updateDoc(groupProgramRef(coachId, groupId, programId), { isActive: true });
}

export async function getActiveGroupProgram(
  coachId: string,
  groupId: string
): Promise<GroupProgram | null> {
  const snap = await getDocs(
    query(
      groupProgramsRef(coachId, groupId),
      where("isActive", "==", true),
      limit(1)
    )
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as GroupProgram;
}

// ─── Group Feed (fase 2 "gara") ───────────────────────────────────────────────
// Writes happen server-side in /api/group-feed (anti-cheating + aggregate
// stats); the client only reads the recent entries for display.

export async function getGroupFeed(
  coachId: string,
  groupId: string,
  limitCount = 30
): Promise<GroupFeedEntry[]> {
  const snap = await getDocs(
    query(groupFeedRef(coachId, groupId), orderBy("date", "desc"), limit(limitCount))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GroupFeedEntry));
}

// ─── Coach library programs ───────────────────────────────────────────────────

export async function getPrograms(coachId: string): Promise<Program[]> {
  const snap = await getDocs(query(programsRef(coachId), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Program));
}

export async function getProgram(coachId: string, programId: string): Promise<Program | null> {
  const snap = await getDoc(programRef(coachId, programId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Program;
}

export async function createProgram(
  coachId: string,
  data: Omit<Program, "id" | "createdAt">
): Promise<DocumentReference> {
  return addDoc(programsRef(coachId), stripUndefined({ ...data, createdAt: Timestamp.now() }));
}

export async function updateProgram(
  coachId: string,
  programId: string,
  data: Partial<Omit<Program, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(programRef(coachId, programId), stripUndefined(data));
}

export async function deleteProgram(coachId: string, programId: string): Promise<void> {
  await deleteDoc(programRef(coachId, programId));
}

export async function setActiveProgram(
  coachId: string,
  programId: string
): Promise<void> {
  const all = await getDocs(programsRef(coachId));
  await Promise.all(all.docs.map((d) => updateDoc(d.ref, { isActive: false })));
  await updateDoc(programRef(coachId, programId), { isActive: true });
}

export async function getActiveProgram(coachId: string): Promise<Program | null> {
  const snap = await getDocs(
    query(programsRef(coachId), where("isActive", "==", true), limit(1))
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Program;
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

export async function getLogs(
  coachId: string,
  athleteId: string,
  limitCount = 20
): Promise<WorkoutLog[]> {
  const snap = await getDocs(
    query(logsRef(coachId, athleteId), orderBy("date", "desc"), limit(limitCount))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkoutLog));
}

export async function getLog(
  coachId: string,
  athleteId: string,
  logId: string
): Promise<WorkoutLog | null> {
  const snap = await getDoc(logRef(coachId, athleteId, logId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as WorkoutLog;
}

export async function createLog(
  coachId: string,
  athleteId: string,
  data: Omit<WorkoutLog, "id" | "createdAt">
): Promise<DocumentReference> {
  return addDoc(logsRef(coachId, athleteId), stripUndefined({
    ...data,
    createdAt: Timestamp.now(),
  }));
}

/** Coach feedback on a single workout log */
export async function updateLogComment(
  coachId: string,
  athleteId: string,
  logId: string,
  coachComment: string
): Promise<void> {
  await updateDoc(logRef(coachId, athleteId, logId), { coachComment });
}

// ─── Adherence (coach dashboard) ──────────────────────────────────────────────

export interface AthleteAdherence {
  athlete: Athlete;
  /** Logged sessions in the last 7 days (count aggregation — 1 read per athlete) */
  weekSessions: number;
  lastLogDate: Date | null;
}

export async function getAthletesAdherence(coachId: string): Promise<AthleteAdherence[]> {
  const athletes = (await getAthletes(coachId)).filter((a) => a.status === "active");
  const weekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  return Promise.all(
    athletes.map(async (athlete) => {
      const [countSnap, lastSnap] = await Promise.all([
        getCountFromServer(
          query(logsRef(coachId, athlete.id), where("date", ">=", weekAgo))
        ),
        getDocs(query(logsRef(coachId, athlete.id), orderBy("date", "desc"), limit(1))),
      ]);
      const last = lastSnap.empty
        ? null
        : (lastSnap.docs[0].data().date as Timestamp).toDate();
      return { athlete, weekSessions: countSnap.data().count, lastLogDate: last };
    })
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getTodaySession(program: Program | AthleteProgram, forDate?: Date): Session | null {
  const today = forDate ? new Date(forDate) : new Date();
  today.setHours(0, 0, 0, 0);
  // Use local date components — toISOString() gives UTC date which is off by 1 day in UTC+ zones
  const todayISO = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  // Pass 1: any session with an explicit scheduledDate matching today wins
  for (const cycle of program.cycles) {
    for (const week of cycle.weeks) {
      for (const session of week.sessions) {
        if (session.scheduledDate === todayISO) return session;
      }
    }
  }

  // Pass 2: startDate-based calendar placement (startDate should be the Monday of week 1).
  // When a program is anchored to a calendar (startDate set), the date placement is
  // authoritative: if nothing lands on today (rest day, or the program has ended), we
  // return null rather than surfacing a stale session from another week. The day-of-week
  // fallback below would otherwise show "un allenamento molto vecchio".
  if (program.startDate) {
    const start = new Date(program.startDate + "T00:00:00");
    let totalWeeks = 0;
    for (const cycle of program.cycles) {
      for (const week of cycle.weeks) {
        for (const session of week.sessions) {
          if (session.scheduledDate) continue;
          const d = new Date(start);
          d.setDate(start.getDate() + totalWeeks * 7 + session.dayOfWeek);
          if (d.getTime() === today.getTime()) return session;
        }
        totalWeeks++;
      }
    }
    return null;
  }

  // Pass 3: day-of-week fallback for undated programs (recurring weekly templates with
  // no startDate). Mon=0 … Sun=6.
  const dow = (today.getDay() + 6) % 7;
  for (const cycle of program.cycles) {
    for (const week of cycle.weeks) {
      for (const session of week.sessions) {
        if (session.scheduledDate) continue;
        if (session.dayOfWeek === dow) return session;
      }
    }
  }
  return null;
}
