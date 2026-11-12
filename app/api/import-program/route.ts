import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Timestamp } from "firebase-admin/firestore";
import { verifyRequestAuth } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { programImportSchema, formatZodError } from "@/lib/schemas/program";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 50_000;
const IMPORT_WINDOW_MS = 15 * 60 * 1000;
const MAX_IMPORTS_PER_WINDOW = 5;

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

/** PDFs may include arbitrary leading bytes; their header must appear in the first 1 KB. */
function hasPdfHeader(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.subarray(0, 1024)).includes(Buffer.from("%PDF-"));
}

/**
 * Global (not instance-local) rate limit backed by Firestore. The import route
 * spends external API credits, so an in-memory limiter would not be sufficient
 * on a serverless deployment with multiple instances.
 */
async function consumeImportSlot(coachId: string): Promise<number | null> {
  const db = getAdminDb();
  const ref = db.doc(`importUsage/${coachId}`);
  const now = Timestamp.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const windowStartedAt = data?.windowStartedAt as Timestamp | undefined;
    const count = typeof data?.count === "number" ? data.count : 0;
    const elapsed = windowStartedAt ? now.toMillis() - windowStartedAt.toMillis() : Infinity;

    if (elapsed < IMPORT_WINDOW_MS && count >= MAX_IMPORTS_PER_WINDOW) {
      return Math.max(1, Math.ceil((IMPORT_WINDOW_MS - elapsed) / 1000));
    }

    if (elapsed < IMPORT_WINDOW_MS) {
      tx.update(ref, { count: count + 1, lastAttemptAt: now });
    } else {
      tx.set(ref, { windowStartedAt: now, count: 1, lastAttemptAt: now });
    }
    return null;
  });
}

export async function POST(req: NextRequest) {
  try {
    // Only real coaches may use an endpoint that spends Anthropic credits.
    const caller = await verifyRequestAuth(req);
    if (!caller) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    const db = getAdminDb();
    const coach = await db.doc(`coaches/${caller.uid}`).get();
    if (!coach.exists) {
      return NextResponse.json({ error: "Funzione riservata ai coach" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const textContent = formData.get("text");

    if (file && typeof file !== "string") {
      if (file.size === 0) {
        return NextResponse.json({ error: "Il PDF è vuoto" }, { status: 400 });
      }
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json(
          { error: "Il PDF supera la dimensione massima di 10 MB" },
          { status: 413 }
        );
      }
    } else if (typeof textContent === "string") {
      if (!textContent.trim()) {
        return NextResponse.json({ error: "Nessun contenuto fornito" }, { status: 400 });
      }
      if (textContent.length > MAX_TEXT_CHARS) {
        return NextResponse.json(
          { error: "Il testo supera il limite di 50.000 caratteri" },
          { status: 413 }
        );
      }
    } else {
      return NextResponse.json({ error: "Nessun contenuto fornito" }, { status: 400 });
    }

    const retryAfter = await consumeImportSlot(caller.uid);
    if (retryAfter) {
      return NextResponse.json(
        { error: "Hai raggiunto il limite di importazioni. Riprova tra qualche minuto." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const client = getAnthropicClient();
    if (!client) {
      return NextResponse.json({ error: "Import AI non configurato" }, { status: 503 });
    }

    if (file && typeof file !== "string") {
      const arrayBuffer = await file.arrayBuffer();
      if (!hasPdfHeader(new Uint8Array(arrayBuffer))) {
        return NextResponse.json({ error: "Il file caricato non è un PDF valido" }, { status: 415 });
      }
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

    } else if (typeof textContent === "string") {
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
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Import program error:", message);
    return NextResponse.json({ error: "Errore durante l'importazione. Riprova." }, { status: 500 });
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
