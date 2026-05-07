import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { adminGetLogs, adminUpdateLogAI } from "@/lib/firestore-admin";
import type { Session, WorkoutLog, AIAnalysis } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RequestBody {
  coachId: string;
  athleteId: string;
  logId: string;
  plannedSession: Session | null;
  logData: Omit<WorkoutLog, "id" | "createdAt">;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { coachId, athleteId, logId, plannedSession, logData } = body;

    // Fetch last 5 logs for context (Admin SDK — bypasses Firestore rules)
    const recentLogs = await adminGetLogs(coachId, athleteId, 6);
    const contextLogs = recentLogs.filter((l) => l.id !== logId).slice(0, 5);

    const contextSummary = contextLogs.length > 0
      ? contextLogs.map((l) => (
          `- ${new Date(l.date.seconds * 1000).toLocaleDateString("it-IT")}: ` +
          `RPE ${l.perceivedRPE}, umore ${l.mood}/5, energia ${l.energyLevel}/5, ` +
          `durata ${l.actualDurationMin} min` +
          (l.notes ? `, note: "${l.notes}"` : "")
        )).join("\n")
      : "Nessun allenamento precedente disponibile.";

    const sessionInfo = plannedSession
      ? `
Sessione programmata:
- Titolo: ${plannedSession.title}
- Tipo: ${plannedSession.type}
- Target RPE: ${plannedSession.targetRPE}
- Durata pianificata: ${plannedSession.durationMin} min
- Esercizi: ${plannedSession.exercises.map((e) => `${e.name} ${e.sets}×${e.reps} ${e.load}`).join(", ")}
- Note sessione: ${plannedSession.notes || "nessuna"}
`
      : "Sessione libera (non programmata)";

    const prompt = `Sei un coach sportivo esperto e motivante. Analizza il seguente allenamento e fornisci feedback personalizzato in italiano.

${sessionInfo}

Dati effettivi dell'allenamento:
- Durata effettiva: ${logData.actualDurationMin} min
- RPE percepito: ${logData.perceivedRPE}/10
- Umore: ${logData.mood}/5
- Livello energia: ${logData.energyLevel}/5
- Note dell'atleta: ${logData.notes || "nessuna"}

Ultimi 5 allenamenti per contesto e trend:
${contextSummary}

Rispondi SOLO con un JSON valido (nessun testo prima o dopo) nel seguente formato:
{
  "summary": "Riepilogo dell'allenamento in 2-3 frasi, tono diretto e motivante",
  "positives": ["punto positivo 1", "punto positivo 2"],
  "suggestions": ["suggerimento pratico 1"],
  "flags": ["segnalazione di attenzione se necessario, altrimenti array vuoto"],
  "nextSessionTip": "Un consiglio specifico per la prossima sessione"
}

Considera:
- Se RPE effettivo è molto diverso dal target, commentalo
- Tieni conto del trend di umore ed energia degli ultimi giorni
- Sii specifico e pratico, non generico
- Se ci sono segnali di sovrallenamento o stanchezza, segnalalo nei flags
- Non inventare dati non presenti`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON response
    let aiAnalysis: AIAnalysis;
    try {
      // Extract JSON if there's any surrounding text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      aiAnalysis = JSON.parse(jsonMatch[0]);
    } catch {
      // Fallback if parsing fails
      aiAnalysis = {
        summary: responseText.slice(0, 200),
        positives: [],
        suggestions: [],
        flags: [],
        nextSessionTip: "",
      };
    }

    // Persist AI analysis back to Firestore (Admin SDK)
    await adminUpdateLogAI(coachId, athleteId, logId, aiAnalysis);

    return NextResponse.json({ success: true, aiAnalysis });
  } catch (error) {
    console.error("AI feedback error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
