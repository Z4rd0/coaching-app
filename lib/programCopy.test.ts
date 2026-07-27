import { describe, it, expect } from "vitest";
import { programCopyPayload } from "@/lib/firestore";
import type { Program } from "@/types";

function template(extra: Partial<Program> = {}): Program {
  return {
    id: "tpl-1",
    name: "Forza Base",
    sport: "Powerlifting",
    cycles: [{ cycleNumber: 1, weeks: [{ weekNumber: 1, sessions: [] }] }],
    ...extra,
  } as Program;
}

describe("programCopyPayload", () => {
  it("never inherits isActive from the template", () => {
    // The template being the coach's active library program must not make the
    // athlete's copy active too — that is how two 'active' programs appeared,
    // with getActiveAthleteProgram (limit(1), unordered) picking arbitrarily.
    const payload = programCopyPayload(template({ isActive: true }));
    expect(payload.isActive).toBe(false);
  });

  it("never inherits the template's startDate", () => {
    const payload = programCopyPayload(template({ startDate: "2020-01-06" }));
    expect(payload.startDate).toBeUndefined();
  });

  it("uses the caller's startDate for the copy", () => {
    const payload = programCopyPayload(template({ startDate: "2020-01-06" }), {
      startDate: "2026-08-03",
    });
    expect(payload.startDate).toBe("2026-08-03");
  });

  it("keeps the program content and links back to the source template", () => {
    const src = template();
    const payload = programCopyPayload(src);
    expect(payload.name).toBe("Forza Base");
    expect(payload.sport).toBe("Powerlifting");
    expect(payload.cycles).toEqual(src.cycles);
    expect(payload.sourceTemplateId).toBe("tpl-1");
    expect(payload.status).toBe("active");
  });

  it("does not carry the template's own document id or createdAt", () => {
    const payload = programCopyPayload(template({ createdAt: "X" as never }));
    expect("id" in payload).toBe(false);
    expect("createdAt" in payload).toBe(false);
  });
});
