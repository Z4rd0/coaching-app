import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifyRequestAuth } from "@/lib/server-auth";
import { programImportSchema, formatZodError } from "@/lib/schemas/program";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    // Authenticated users only — this endpoint spends Anthropic credits
    const caller = await verifyRequestAuth(req);
    if (!caller) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const textContent = formData.get("text") as string | null;

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      // PDF via document block (requires claude-sonnet-4-5 or later)
      const message = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              } as Anthropic.DocumentBlockParam,
              {
                type: "text",
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      });

      return parseAndReturn(message);

    } else if (textContent) {
      const message = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `Testo del programma di allenamento:\n\n${textContent}\n\n${EXTRACTION_PROMPT}`,
          },
        ],
      });

      return parseAndReturn(message);

    } else {
      return NextResponse.json({ error: "Nessun contenuto fornito" }, { status: 400 });
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Import program error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseAndReturn(message: Anthropic.Message) {
  const responseText = message.content[0].type === "text" ? message.content[0].text : "";

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json(
      { error: "Claude non ha restituito JSON valido", raw: responseText.slice(0, 500) },
      { status: 422 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json({ error: "JSON non parsabile", raw: jsonMatch[0].slice(0, 500) }, { status: 422 });
  }

  // Validate the LLM output at the boundary before handing it to the client
  // (AUDIT ALTO-2 / §9 anticipated Zod). Coerces common type drifts.
  const result = programImportSchema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json(
      { error: `Struttura programma non valida: ${formatZodError(result.error)}`, raw: responseText.slice(0, 500) },
      { status: 422 }
    );
  }

  return NextResponse.json({ success: true, program: result.data });
}

const EXTRACTION_PROMPT = `
Analizza questo programma di allenamento ed estrailo in formato JSON strutturato.

Restituisci SOLO un JSON valido (nessun testo prima o dopo) con questa struttura esatta:

{
  "name": "Nome del programma",
  "sport": "Sport o disciplina (es. Powerlifting, Running, Crossfit)",
  "cycles": [
    {
      "cycleNumber": 1,
      "weeks": [
        {
          "weekNumber": 1,
          "sessions": [
            {
              "dayOfWeek": 0,
              "type": "strength",
              "title": "Nome della sessione",
              "exercises": [
                {
                  "name": "Nome esercizio",
                  "sets": 3,
                  "reps": "8",
                  "load": "70% 1RM",
                  "notes": ""
                }
              ],
              "targetRPE": 7,
              "durationMin": 60,
              "notes": ""
            }
          ]
        }
      ]
    }
  ]
}

Regole:
- dayOfWeek: 0=Lunedì, 1=Martedì, 2=Mercoledì, 3=Giovedì, 4=Venerdì, 5=Sabato, 6=Domenica
- type: usa solo "strength", "cardio", "mobility", "rest", "other"
- Se il PDF ha più cicli o fasi, crea più oggetti in "cycles"
- Se non trovi un RPE target, usa 7 come default
- Se non trovi la durata, stima in base al numero di esercizi (circa 5-7 min per esercizio)
- reps è una stringa (es. "8", "8-10", "AMRAP", "60 sec")
- sets è un numero intero
- Se il programma non ha esercizi dettagliati ma solo descrizioni, crea esercizi con i nomi trovati
- Mantieni la struttura originale del programma il più possibile
`;
