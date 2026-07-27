import type { Cycle, Program } from "@/types";
import {
  getProgram, createProgram, updateProgram, deleteProgram, setActiveProgram,
  getAthlete, getAthleteProgram, createAthleteProgram, updateAthleteProgram,
  deleteAthleteProgram, setActiveAthleteProgram, copyProgramToAthlete,
  getGroup, getGroupProgram, createGroupProgram, updateGroupProgram,
  deleteGroupProgram, setActiveGroupProgram, copyProgramToGroup,
} from "@/lib/firestore";

/** Everything the program form edits. */
export interface ProgramFormValues {
  name: string;
  sport: string;
  /** ISO "YYYY-MM-DD" — required (see the startDate decision in ANALISI_CONFLITTI M1). */
  startDate: string;
  cycles: Cycle[];
  /** "programma corrente" for this athlete/group (or the coach's own library). */
  isActive: boolean;
  status: ProgramStatus;
}

export type ProgramStatus = "active" | "completed" | "paused";

/**
 * One CRUD surface over the three places a program can live: the coach's
 * library, an athlete's personal copy, and a group's shared copy.
 *
 * The three sets of functions in lib/firestore are already symmetric; what was
 * missing was something to name that symmetry, so six near-identical authoring
 * pages each hard-wired their own triple. Every bug in them had to be fixed six
 * times — which is exactly how they drifted apart.
 */
export interface ProgramStore {
  /** Whether this context has a status field and a "programma corrente" toggle. */
  readonly supportsStatus: boolean;
  /** Label under the page title, e.g. "per Marco Rossi". */
  contextLabel(): Promise<string | null>;
  /** Where to navigate after save or delete. */
  readonly returnPath: string;
  load(programId: string): Promise<ProgramFormValues | null>;
  create(values: ProgramFormValues): Promise<string>;
  update(programId: string, values: ProgramFormValues): Promise<void>;
  remove(programId: string): Promise<void>;
  setActive(programId: string): Promise<void>;
  /** Copy a library template into this context. Absent for the library itself. */
  copyTemplate?(template: Program, startDate: string): Promise<string>;
}

/** The shared shape of an update payload.
 *
 *  `isActive: false` is written explicitly when the toggle is off: activation
 *  goes through setActive*, which only ever runs in the checked branch, so
 *  without this an unchecked program would stay active. */
function payload(values: ProgramFormValues, withStatus: boolean) {
  return {
    name: values.name.trim(),
    sport: values.sport.trim(),
    cycles: values.cycles,
    startDate: values.startDate,
    ...(withStatus ? { status: values.status } : {}),
    ...(values.isActive ? {} : { isActive: false }),
  };
}

export function libraryProgramStore(coachId: string): ProgramStore {
  return {
    supportsStatus: false,
    returnPath: "/programs",
    contextLabel: async () => null,
    async load(programId) {
      const p = await getProgram(coachId, programId);
      if (!p) return null;
      return {
        name: p.name,
        sport: p.sport ?? "",
        startDate: p.startDate ?? "",
        cycles: p.cycles,
        isActive: p.isActive ?? false,
        status: "active",
      };
    },
    async create(values) {
      const ref = await createProgram(coachId, {
        ...payload(values, false),
        isActive: false,
      } as Parameters<typeof createProgram>[1]);
      return ref.id;
    },
    async update(programId, values) {
      await updateProgram(coachId, programId, payload(values, false));
    },
    remove: (programId) => deleteProgram(coachId, programId),
    setActive: (programId) => setActiveProgram(coachId, programId),
  };
}

export function athleteProgramStore(coachId: string, athleteId: string): ProgramStore {
  return {
    supportsStatus: true,
    returnPath: `/athletes/${athleteId}`,
    contextLabel: async () => {
      const a = await getAthlete(coachId, athleteId);
      return a ? `per ${a.name}` : null;
    },
    async load(programId) {
      const p = await getAthleteProgram(coachId, athleteId, programId);
      if (!p) return null;
      return {
        name: p.name,
        sport: p.sport ?? "",
        startDate: p.startDate ?? "",
        cycles: p.cycles,
        isActive: p.isActive ?? false,
        status: p.status,
      };
    },
    async create(values) {
      const ref = await createAthleteProgram(coachId, athleteId, {
        ...payload(values, true),
        status: values.status,
      });
      return ref.id;
    },
    async update(programId, values) {
      await updateAthleteProgram(coachId, athleteId, programId, payload(values, true));
    },
    remove: (programId) => deleteAthleteProgram(coachId, athleteId, programId),
    setActive: (programId) => setActiveAthleteProgram(coachId, athleteId, programId),
    async copyTemplate(template, startDate) {
      const ref = await copyProgramToAthlete(coachId, athleteId, template, { startDate });
      return ref.id;
    },
  };
}

export function groupProgramStore(coachId: string, groupId: string): ProgramStore {
  return {
    supportsStatus: true,
    returnPath: `/groups/${groupId}`,
    contextLabel: async () => {
      const g = await getGroup(coachId, groupId);
      return g ? `gruppo ${g.name}` : null;
    },
    async load(programId) {
      const p = await getGroupProgram(coachId, groupId, programId);
      if (!p) return null;
      return {
        name: p.name,
        sport: p.sport ?? "",
        startDate: p.startDate ?? "",
        cycles: p.cycles,
        isActive: p.isActive ?? false,
        status: p.status,
      };
    },
    async create(values) {
      const ref = await createGroupProgram(coachId, groupId, {
        ...payload(values, true),
        status: values.status,
      });
      return ref.id;
    },
    async update(programId, values) {
      await updateGroupProgram(coachId, groupId, programId, payload(values, true));
    },
    remove: (programId) => deleteGroupProgram(coachId, groupId, programId),
    setActive: (programId) => setActiveGroupProgram(coachId, groupId, programId),
    async copyTemplate(template, startDate) {
      const ref = await copyProgramToGroup(coachId, groupId, template, { startDate });
      return ref.id;
    },
  };
}
