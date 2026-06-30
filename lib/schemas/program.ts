/**
 * Boundary validation for LLM-extracted programs (the /api/import-program route).
 *
 * This is the "anticipated" Zod layer from AUDIT §9: it guards ONLY the trust
 * boundary where Claude-extracted program data is returned to the client. It is
 * NOT the canonical app schema — that one will be defined in the new
 * composable-segments shape during the §6 redesign, and this guard will be
 * reconciled with it then. (Kept in sync with coaching-mcp/src/schema.ts.)
 *
 * Deliberately lenient: objects use .passthrough() and common LLM type drifts
 * are coerced (numeric strings → numbers, numeric reps → string).
 */
import { z } from "zod";

export const SESSION_TYPES = [
  "strength",
  "cardio",
  "mobility",
  "rest",
  "other",
  "circuit",
  "hiit",
] as const;

const stringy = z.union([z.string(), z.number()]).transform(String);

const exerciseSchema = z
  .object({
    name: z.string().min(1, "nome esercizio mancante"),
    sets: z.coerce.number(),
    reps: stringy,
    load: stringy.optional(),
    restSeconds: z.coerce.number().optional(),
    notes: z.string().optional(),
    variants: z.string().optional(),
  })
  .passthrough();

const sessionSchema = z
  .object({
    dayOfWeek: z.coerce.number().min(0).max(6),
    type: z.enum(SESSION_TYPES),
    title: z.string().min(1, "titolo sessione mancante"),
    exercises: z.array(exerciseSchema).default([]),
    targetRPE: z.coerce.number().optional(),
    durationMin: z.coerce.number().optional(),
    notes: z.string().optional(),
    scheduledDate: z.string().optional(),
  })
  .passthrough();

const weekSchema = z
  .object({
    weekNumber: z.coerce.number(),
    sessions: z.array(sessionSchema).default([]),
  })
  .passthrough();

const cycleSchema = z
  .object({
    cycleNumber: z.coerce.number(),
    weeks: z.array(weekSchema).default([]),
  })
  .passthrough();

export const programImportSchema = z
  .object({
    name: z.string().min(1, "nome programma mancante"),
    sport: z.string().min(1).optional().default("Generico"),
    cycles: z.array(cycleSchema).min(1, "nessun ciclo trovato"),
    startDate: z.string().optional(),
  })
  .passthrough();

export type ImportedProgram = z.infer<typeof programImportSchema>;

/** Compact one-line summary of a ZodError for an API error message. */
export function formatZodError(err: z.ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}
