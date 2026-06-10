import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { WorkoutLog, Athlete, AthleteProgram } from "@/types";
import { MOOD_LABELS, ENERGY_LABELS, SESSION_TYPE_LABELS } from "@/types";

function formatSingleLog(log: WorkoutLog): string {
  const lines: string[] = [];
  const dateStr = format(log.date.toDate(), "EEEE d MMMM yyyy", { locale: it });

  lines.push(`## Sessione del ${dateStr}`);
  if (log.plannedSession?.title) {
    lines.push(`**Sessione pianificata:** ${log.plannedSession.title} · ${SESSION_TYPE_LABELS[log.plannedSession.type]}`);
  }
  lines.push(`**Registrato da:** ${log.writtenBy === "athlete" ? "Atleta" : "Coach"}`);
  lines.push("");

  lines.push("### Metriche");
  lines.push(`- Durata: ${log.actualDurationMin} min${log.plannedSession?.durationMin ? ` (target: ${log.plannedSession.durationMin} min)` : ""}`);
  lines.push(`- RPE percepito: ${log.perceivedRPE}/10${log.plannedSession?.targetRPE ? ` (target: ${log.plannedSession.targetRPE}/10)` : ""}`);
  lines.push(`- Umore: ${log.mood}/5 ${MOOD_LABELS[log.mood] ?? ""}`);
  lines.push(`- Livello energia: ${log.energyLevel}/5 ${ENERGY_LABELS[log.energyLevel] ?? ""}`);
  lines.push("");

  if (log.plannedSession?.notes) {
    lines.push("### Note sessione pianificata");
    lines.push(log.plannedSession.notes);
    lines.push("");
  }

  if (log.exerciseLogs && log.exerciseLogs.length > 0) {
    lines.push("### Esercizi");
    for (const ex of log.exerciseLogs) {
      lines.push(`**${ex.name}**`);
      lines.push(`- Pianificato: ${ex.plannedSets ?? "—"}×${ex.plannedReps ?? "—"}${ex.plannedLoad ? ` @ ${ex.plannedLoad}` : ""}`);
      lines.push(`- Effettivo: ${ex.actualSets ?? "—"}×${ex.actualReps ?? "—"}${ex.actualLoad ? ` @ ${ex.actualLoad}` : ""}`);
      if (ex.rpe !== undefined) lines.push(`- RPE: ${ex.rpe}`);
      if (ex.notes) lines.push(`- Note: ${ex.notes}`);
      lines.push("");
    }
  }

  if (log.cardioLog) {
    const c = log.cardioLog;
    lines.push("### Dati cardio");
    if (c.avgHeartRate) lines.push(`- FC media: ${c.avgHeartRate} bpm`);
    if (c.maxHeartRate) lines.push(`- FC max: ${c.maxHeartRate} bpm`);
    if (c.distanceMeters) lines.push(`- Distanza: ${(c.distanceMeters / 1000).toFixed(2)} km`);
    if (c.avgPaceMinPerKm) lines.push(`- Passo medio: ${c.avgPaceMinPerKm} /km`);
    if (c.calories) lines.push(`- Calorie: ${c.calories} kcal`);
    if (c.hrZoneMinutes) {
      const z = c.hrZoneMinutes;
      const zoneParts: string[] = [];
      if (z.z1) zoneParts.push(`Z1: ${z.z1}′`);
      if (z.z2) zoneParts.push(`Z2: ${z.z2}′`);
      if (z.z3) zoneParts.push(`Z3: ${z.z3}′`);
      if (z.z4) zoneParts.push(`Z4: ${z.z4}′`);
      if (z.z5) zoneParts.push(`Z5: ${z.z5}′`);
      if (zoneParts.length > 0) lines.push(`- Zone HR: ${zoneParts.join(" · ")}`);
    }
    lines.push("");
  }

  if (log.circuitLog) {
    const c = log.circuitLog;
    lines.push("### Circuit");
    lines.push(`- Round completati: **${c.roundsCompleted}**`);
    if (c.restBetweenRoundsSeconds) lines.push(`- Recupero tra round: ${c.restBetweenRoundsSeconds >= 60 ? `${c.restBetweenRoundsSeconds / 60}m` : `${c.restBetweenRoundsSeconds}s`}`);
    if (c.avgHeartRate) lines.push(`- FC media: ${c.avgHeartRate} bpm`);
    if (c.maxHeartRate) lines.push(`- FC max: ${c.maxHeartRate} bpm`);
    if (c.calories) lines.push(`- Calorie: ${c.calories} kcal`);
    if (c.hrZoneMinutes) {
      const z = c.hrZoneMinutes;
      const zoneParts: string[] = [];
      if (z.z1) zoneParts.push(`Z1: ${z.z1}′`);
      if (z.z2) zoneParts.push(`Z2: ${z.z2}′`);
      if (z.z3) zoneParts.push(`Z3: ${z.z3}′`);
      if (z.z4) zoneParts.push(`Z4: ${z.z4}′`);
      if (z.z5) zoneParts.push(`Z5: ${z.z5}′`);
      if (zoneParts.length > 0) lines.push(`- Zone HR: ${zoneParts.join(" · ")}`);
    }
    lines.push("");
  }

  if (log.notes) {
    lines.push("### Note atleta");
    lines.push(log.notes);
    lines.push("");
  }

  if (log.aiAnalysis) {
    const ai = log.aiAnalysis;
    lines.push("### Analisi AI");
    lines.push(ai.summary);
    if (ai.positives.length > 0) lines.push(`- Positivi: ${ai.positives.join("; ")}`);
    if (ai.suggestions.length > 0) lines.push(`- Suggerimenti: ${ai.suggestions.join("; ")}`);
    if (ai.flags.length > 0) lines.push(`- Attenzione: ${ai.flags.join("; ")}`);
    if (ai.nextSessionTip) lines.push(`- Prossima sessione: ${ai.nextSessionTip}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function buildSingleLogExport(log: WorkoutLog, athlete: Athlete): string {
  const lines: string[] = [];
  const dateStr = format(log.date.toDate(), "d MMMM yyyy", { locale: it });

  lines.push(`# Log allenamento — ${athlete.name} — ${dateStr}`);
  lines.push("");
  lines.push("## Profilo atleta");
  lines.push(`- Sport: ${athlete.sport || "—"}`);
  if (athlete.goals) lines.push(`- Obiettivi: ${athlete.goals}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(formatSingleLog(log));

  return lines.join("\n");
}

export function buildFullExport(
  logs: WorkoutLog[],
  athlete: Athlete,
  programs: AthleteProgram[]
): string {
  const lines: string[] = [];
  const exportDate = format(new Date(), "d MMMM yyyy 'alle' HH:mm", { locale: it });

  lines.push(`# Report completo — ${athlete.name}`);
  lines.push(`*Esportato il ${exportDate}*`);
  lines.push("");

  lines.push("## Profilo atleta");
  lines.push(`- Sport: ${athlete.sport || "—"}`);
  if (athlete.goals) lines.push(`- Obiettivi: ${athlete.goals}`);
  if (athlete.notes) lines.push(`- Note coach: ${athlete.notes}`);
  lines.push("");

  if (programs.length > 0) {
    lines.push("## Programmi assegnati");
    for (const p of programs) {
      lines.push(`- **${p.name}** (${p.status}) — ${p.cycles.length} cicli`);
    }
    lines.push("");
  }

  if (logs.length > 0) {
    const avgRPE = (logs.reduce((s, l) => s + l.perceivedRPE, 0) / logs.length).toFixed(1);
    const avgDuration = Math.round(logs.reduce((s, l) => s + l.actualDurationMin, 0) / logs.length);
    lines.push("## Statistiche");
    lines.push(`- Sessioni totali: ${logs.length}`);
    lines.push(`- RPE medio: ${avgRPE}/10`);
    lines.push(`- Durata media: ${avgDuration} min`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Log allenamenti");
  lines.push("");

  const sorted = [...logs].sort((a, b) => a.date.toMillis() - b.date.toMillis());
  for (const log of sorted) {
    lines.push(formatSingleLog(log));
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export function buildCoachExport(
  athletes: Athlete[],
  logsByAthlete: Record<string, WorkoutLog[]>,
  programsByAthlete: Record<string, AthleteProgram[]>
): string {
  const lines: string[] = [];
  const exportDate = format(new Date(), "d MMMM yyyy 'alle' HH:mm", { locale: it });

  lines.push("# Report globale coach");
  lines.push(`*Esportato il ${exportDate}*`);
  lines.push(`*${athletes.length} atleti*`);
  lines.push("");

  for (const athlete of athletes) {
    const logs = logsByAthlete[athlete.id] ?? [];
    const programs = programsByAthlete[athlete.id] ?? [];

    lines.push(`# Atleta: ${athlete.name}`);
    lines.push("");

    lines.push("## Profilo");
    lines.push(`- Sport: ${athlete.sport || "—"}`);
    lines.push(`- Email: ${athlete.email || "—"}`);
    if (athlete.goals) lines.push(`- Obiettivi: ${athlete.goals}`);
    if (athlete.notes) lines.push(`- Note coach: ${athlete.notes}`);
    lines.push("");

    if (programs.length > 0) {
      lines.push("## Programmi");
      for (const p of programs) {
        lines.push(`- **${p.name}** (${p.status}) — ${p.cycles.length} cicli`);
      }
      lines.push("");
    }

    if (logs.length > 0) {
      const avgRPE = (logs.reduce((s, l) => s + l.perceivedRPE, 0) / logs.length).toFixed(1);
      const avgDuration = Math.round(logs.reduce((s, l) => s + l.actualDurationMin, 0) / logs.length);
      lines.push("## Statistiche");
      lines.push(`- Sessioni totali: ${logs.length}`);
      lines.push(`- RPE medio: ${avgRPE}/10`);
      lines.push(`- Durata media: ${avgDuration} min`);
      lines.push("");

      lines.push("## Log allenamenti");
      lines.push("");
      const sorted = [...logs].sort((a, b) => a.date.toMillis() - b.date.toMillis());
      for (const log of sorted) {
        lines.push(formatSingleLog(log));
        lines.push("---");
        lines.push("");
      }
    } else {
      lines.push("*Nessun log registrato.*");
      lines.push("");
    }

    lines.push("═══════════════════════════════════════");
    lines.push("");
  }

  return lines.join("\n");
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
