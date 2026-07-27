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
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import { serializeProgramForWrite } from "./segments";
import { toLocalISODate, fromLocalISODate } from "./dates";
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

export async function createCoach(
  uid: string,
  name: string,
  email: string,
  opts?: { specialization?: string }
): Promise<void> {
  await setDoc(
    coachRef(uid),
    {
      name,
      email,
      createdAt: Timestamp.now(),
      settings: {},
      status: "active",
      plan: "free",
      exempt: false,
      onboardingCompletedAt: Timestamp.now(),
      ...(opts?.specialization ? { specialization: opts.specialization } : {}),
    },
    // merge keeps any unrelated fields already on the doc. Founders never reach
    // this path (they have a doc → detected as coach → skip onboarding).
    { merge: true }
  );
}

/** Merge a patch into the coach's free-form `settings` map (alert thresholds,
 *  future preferences). Dotted paths so one key never clobbers the others. */
export async function updateCoachSettings(
  coachId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const dotted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) dotted[`settings.${k}`] = v;
  await updateDoc(coachRef(coachId), stripUndefined(dotted));
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
  return addDoc(athleteProgramsRef(coachId, athleteId), stripUndefined(serializeProgramForWrite({
    ...data,
    createdAt: Timestamp.now(),
  })));
}

export async function updateAthleteProgram(
  coachId: string,
  athleteId: string,
  programId: string,
  data: Partial<Omit<AthleteProgram, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(athleteProgramRef(coachId, athleteId, programId), stripUndefined(serializeProgramForWrite(data)));
}

export async function deleteAthleteProgram(
  coachId: string,
  athleteId: string,
  programId: string
): Promise<void> {
  await deleteDoc(athleteProgramRef(coachId, athleteId, programId));
}

/** The document body for a program copied from a library template.
 *
 *  Two fields are deliberately NOT inherited from the template:
 *  - `isActive`: activation is a separate, explicit step (setActive*Program),
 *    which is the only thing that may deactivate the other programs. Copying it
 *    would leave two documents flagged active and make getActive*Program — a
 *    `limit(1)` with no ordering — return an arbitrary one.
 *  - `startDate`: the template's calendar anchor is meaningless for the target;
 *    the caller supplies the real one.
 *
 *  Pure, so the "a copy is never born active" rule is unit-testable. */
export function programCopyPayload(
  sourceProgram: Program,
  opts?: { startDate?: string }
): Omit<AthleteProgram, "id" | "createdAt"> {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { id, createdAt: _createdAt, isActive: _isActive, startDate: _startDate, ...rest } = sourceProgram;
  /* eslint-enable @typescript-eslint/no-unused-vars */
  return {
    ...rest,
    sourceTemplateId: id,
    status: "active",
    isActive: false,
    ...(opts?.startDate ? { startDate: opts.startDate } : {}),
  } as Omit<AthleteProgram, "id" | "createdAt">;
}

/** Copy a coach library program and assign it to an athlete. */
export async function copyProgramToAthlete(
  coachId: string,
  athleteId: string,
  sourceProgram: Program,
  opts?: { startDate?: string }
): Promise<DocumentReference> {
  return createAthleteProgram(coachId, athleteId, programCopyPayload(sourceProgram, opts));
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
  return addDoc(groupProgramsRef(coachId, groupId), stripUndefined(serializeProgramForWrite({
    ...data,
    createdAt: Timestamp.now(),
  })));
}

export async function updateGroupProgram(
  coachId: string,
  groupId: string,
  programId: string,
  data: Partial<Omit<GroupProgram, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(groupProgramRef(coachId, groupId, programId), stripUndefined(serializeProgramForWrite(data)));
}

export async function deleteGroupProgram(
  coachId: string,
  groupId: string,
  programId: string
): Promise<void> {
  await deleteDoc(groupProgramRef(coachId, groupId, programId));
}

/** Copy a coach library program into a group (shared — not per-athlete).
 *  `isActive` and `startDate` are not inherited: see programCopyPayload. */
export async function copyProgramToGroup(
  coachId: string,
  groupId: string,
  sourceProgram: Program,
  opts?: { startDate?: string }
): Promise<DocumentReference> {
  return createGroupProgram(coachId, groupId, programCopyPayload(sourceProgram, opts));
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
  return addDoc(programsRef(coachId), stripUndefined(serializeProgramForWrite({ ...data, createdAt: Timestamp.now() })));
}

export async function updateProgram(
  coachId: string,
  programId: string,
  data: Partial<Omit<Program, "id" | "createdAt">>
): Promise<void> {
  await updateDoc(programRef(coachId, programId), stripUndefined(serializeProgramForWrite(data)));
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
  /** Logged sessions in the last 7 days */
  weekSessions: number;
  lastLogDate: Date | null;
  /** Logs from the last 28 days — the window the load maths needs. */
  recentLogs: WorkoutLog[];
  /** Sessions the athlete's active program planned over the last 7 days. */
  plannedLast7: number;
}

/**
 * Everything the coach dashboard needs to decide who needs attention.
 *
 * The 28-day log window replaces what used to be a bare count aggregation: the
 * acute:chronic ratio needs the actual daily loads, and the "no news from this
 * athlete" check needs their notes. That is 3 reads per athlete (logs, last log,
 * active program) instead of 2 — deliberate, and the reason the whole thing is
 * computed once at dashboard load rather than per card.
 */
export async function getAthletesAdherence(coachId: string): Promise<AthleteAdherence[]> {
  const athletes = (await getAthletes(coachId)).filter((a) => a.status === "active");
  const now = new Date();
  const weekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = Timestamp.fromDate(new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000));

  return Promise.all(
    athletes.map(async (athlete) => {
      const [recentSnap, lastSnap, program] = await Promise.all([
        getDocs(
          query(
            logsRef(coachId, athlete.id),
            where("date", ">=", monthAgo),
            orderBy("date", "desc")
          )
        ),
        getDocs(query(logsRef(coachId, athlete.id), orderBy("date", "desc"), limit(1))),
        getActiveAthleteProgram(coachId, athlete.id).catch(() => null),
      ]);

      const recentLogs = recentSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as WorkoutLog)
      );
      const weekSessions = recentLogs.filter((l) => l.date.toMillis() > weekAgoMs).length;
      const last = lastSnap.empty
        ? null
        : (lastSnap.docs[0].data().date as Timestamp).toDate();

      // How many sessions the plan called for over the last 7 days (today
      // included), so adherence compares like with like.
      let plannedLast7 = 0;
      if (program) {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        for (let i = 0; i < 7; i++) {
          const d = new Date(day);
          d.setDate(day.getDate() - i);
          plannedLast7 += getSessionsForDate(program, d).filter(
            (s) => s.type !== "rest"
          ).length;
        }
      }

      return { athlete, weekSessions, lastLogDate: last, recentLogs, plannedLast7 };
    })
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** A session placed on a calendar day, carrying the coordinates it came from so
 *  callers can label it ("Ciclo 2 · Settimana 3") without re-walking the tree. */
export interface ScheduledSession {
  session: Session;
  cycleNumber: number;
  weekNumber: number;
}

/** ALL sessions that fall on `date`, with their cycle/week coordinates (there
 *  can be more than one — e.g. after rescheduling two sessions onto the same
 *  day). Placement: explicit scheduledDate first, then startDate-based calendar
 *  placement, then (only for undated programs) recurring day-of-week.
 *
 *  This is the single source of truth for "what is planned on day X": calendar,
 *  dashboard and the log pages all go through it, so a session can never show up
 *  on different days in different pages. */
export function getScheduledSessionsForDate(
  program: Program | AthleteProgram,
  date: Date
): ScheduledSession[] {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  // Local components, never toISOString(): see lib/dates.ts.
  const dayISO = toLocalISODate(day);

  // Pass 1: sessions explicitly pinned to this date via scheduledDate.
  const pinned: ScheduledSession[] = [];
  for (const cycle of program.cycles) {
    for (const week of cycle.weeks) {
      for (const session of week.sessions) {
        if (session.scheduledDate === dayISO) {
          pinned.push({ session, cycleNumber: cycle.cycleNumber, weekNumber: week.weekNumber });
        }
      }
    }
  }

  // Pass 2: startDate-based calendar placement (startDate = Monday of week 1).
  // Date placement is authoritative: if nothing native lands here we surface
  // only the pinned ones.
  //
  // A program with no startDate places nothing. There used to be a day-of-week
  // fallback here, but a bare weekday has no notion of *which week of the
  // program* we are in, so every week of a cycle collapsed onto the same day —
  // the calendar hid the pile-up by deduping on title (dropping genuinely
  // different sessions that shared one) while the dashboard listed all of them.
  // startDate is now required at every authoring entry point (the app forms and
  // the MCP tools), so this branch only affects legacy documents; callers warn
  // the user rather than silently showing nothing.
  if (!program.startDate) return pinned;

  const start = fromLocalISODate(program.startDate);
  let totalWeeks = 0;
  const dated: ScheduledSession[] = [];
  for (const cycle of program.cycles) {
    for (const week of cycle.weeks) {
      for (const session of week.sessions) {
        if (session.scheduledDate) continue;
        const d = new Date(start);
        d.setDate(start.getDate() + totalWeeks * 7 + session.dayOfWeek);
        if (d.getTime() === day.getTime()) {
          dated.push({ session, cycleNumber: cycle.cycleNumber, weekNumber: week.weekNumber });
        }
      }
      totalWeeks++;
    }
  }
  return [...pinned, ...dated];
}

/** Sessions planned on `date`, without the cycle/week coordinates. */
export function getSessionsForDate(program: Program | AthleteProgram, date: Date): Session[] {
  return getScheduledSessionsForDate(program, date).map((s) => s.session);
}

export function getTodaySession(program: Program | AthleteProgram, forDate?: Date): Session | null {
  return getSessionsForDate(program, forDate ?? new Date())[0] ?? null;
}

/** Position of a session inside a program's cycles/weeks arrays. */
export interface SessionCoords {
  ci: number;
  wi: number;
  si: number;
}

/** Locates a session inside its program by reference identity.
 *
 *  Sessions have no stable id yet, so links that carry a session between pages
 *  address it positionally (`?ci=&wi=&si=`). This turns a Session already read
 *  out of a program (e.g. from getTodaySession) back into those indices, so a
 *  card can deep-link to exactly the session it displays instead of letting the
 *  target page guess. Reference identity is what makes it exact — two sessions
 *  can be structurally identical.
 *
 *  Returns null when the session doesn't belong to this program. */
export function findSessionCoords(
  program: Program | AthleteProgram,
  session: Session
): SessionCoords | null {
  for (let ci = 0; ci < program.cycles.length; ci++) {
    const weeks = program.cycles[ci].weeks;
    for (let wi = 0; wi < weeks.length; wi++) {
      const si = weeks[wi].sessions.indexOf(session);
      if (si !== -1) return { ci, wi, si };
    }
  }
  return null;
}

export interface UpcomingSession {
  date: Date;
  session: Session;
}

/** Every session scheduled over the next `days` days starting at `from`
 *  (default today). Multiple sessions on the same day are all included, so two
 *  workouts moved onto the same date both remain visible (and re-movable). */
export function getUpcomingSessions(
  program: Program | AthleteProgram,
  days = 14,
  from?: Date
): UpcomingSession[] {
  const start = from ? new Date(from) : new Date();
  start.setHours(0, 0, 0, 0);
  const out: UpcomingSession[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    for (const session of getSessionsForDate(program, d)) {
      out.push({ date: new Date(d), session });
    }
  }
  return out;
}
