/**
 * Seed script — popola Firestore con dati di esempio per sviluppo.
 *
 * Prerequisiti:
 *   1. Crea .env.local copiando .env.local.example e compilando i valori Firebase
 *   2. npm install -D dotenv ts-node
 *   3. Esegui: npx ts-node --project tsconfig.json scripts/seed.ts
 *
 * ATTENZIONE: questo script usa le credenziali di servizio client-side
 * (NEXT_PUBLIC_FIREBASE_*) e funziona solo se le regole Firestore lo permettono
 * (in modalità dev o con un service account).
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, addDoc, collection, Timestamp } from "firebase/firestore";
import type { Program, WorkoutLog, AIAnalysis } from "../types";

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const db = getFirestore(app);

// ─── IDs ─────────────────────────────────────────────────────────────────────
// Change COACH_ID to your Firebase Auth UID after first login
const COACH_ID = "REPLACE_WITH_YOUR_UID";
const ATHLETE_ID = COACH_ID; // Phase 1: coach = athlete

async function main() {
  if (COACH_ID === "REPLACE_WITH_YOUR_UID") {
    console.error("❌ Imposta COACH_ID nel file scripts/seed.ts con il tuo Firebase UID");
    process.exit(1);
  }

  console.log("🌱 Seeding Firestore...");

  // ── Coach ────────────────────────────────────────────────────────────────────
  await setDoc(doc(db, "coaches", COACH_ID), {
    name: "Matteo Coach",
    email: "matteo@coachapp.it",
    createdAt: Timestamp.now(),
    settings: {},
  });
  console.log("✅ Coach creato");

  // ── Athlete (self) ────────────────────────────────────────────────────────────
  await setDoc(doc(db, "coaches", COACH_ID, "athletes", ATHLETE_ID), {
    name: "Matteo Coach",
    email: "matteo@coachapp.it",
    goals: "Migliorare forza massimale e resistenza aerobica",
    notes: "Focus su tecnica squat e deadlift",
    garminConnected: false,
  });
  console.log("✅ Atleta creato");

  // ── Program ───────────────────────────────────────────────────────────────────
  const programData: Omit<Program, "id"> = {
    name: "Forza + Corsa — 12 settimane",
    sport: "Powerlifting / Running",
    isActive: true,
    createdAt: Timestamp.now(),
    cycles: [
      {
        cycleNumber: 1,
        weeks: [
          {
            weekNumber: 1,
            sessions: [
              {
                dayOfWeek: 0, // Lunedì
                type: "strength",
                title: "Squat + Upper A",
                exercises: [
                  { name: "Back Squat", sets: 4, reps: "5", load: "75% 1RM", notes: "" },
                  { name: "Panca Piana", sets: 3, reps: "8", load: "70% 1RM", notes: "" },
                  { name: "Rematore con bilanciere", sets: 3, reps: "8", load: "60 kg", notes: "" },
                  { name: "Dips", sets: 3, reps: "AMRAP", load: "bodyweight", notes: "" },
                ],
                targetRPE: 7,
                durationMin: 75,
                notes: "Riscaldamento esteso — prima settimana",
              },
              {
                dayOfWeek: 2, // Mercoledì
                type: "cardio",
                title: "Corsa facile 5km",
                exercises: [],
                targetRPE: 5,
                durationMin: 35,
                notes: "Ritmo conversazionale, Z2",
              },
              {
                dayOfWeek: 4, // Venerdì
                type: "strength",
                title: "Deadlift + Lower",
                exercises: [
                  { name: "Deadlift", sets: 4, reps: "4", load: "80% 1RM", notes: "" },
                  { name: "Romanian Deadlift", sets: 3, reps: "10", load: "60% 1RM", notes: "" },
                  { name: "Leg Press", sets: 3, reps: "12", load: "moderato", notes: "" },
                  { name: "Plank", sets: 3, reps: "45 sec", load: "bodyweight", notes: "" },
                ],
                targetRPE: 7,
                durationMin: 70,
                notes: "",
              },
            ],
          },
          {
            weekNumber: 2,
            sessions: [
              {
                dayOfWeek: 0,
                type: "strength",
                title: "Squat + Upper A",
                exercises: [
                  { name: "Back Squat", sets: 4, reps: "5", load: "77.5% 1RM", notes: "Progressione +2.5%" },
                  { name: "Panca Piana", sets: 3, reps: "8", load: "72.5% 1RM", notes: "" },
                  { name: "Rematore con bilanciere", sets: 3, reps: "8", load: "62.5 kg", notes: "" },
                  { name: "Dips", sets: 3, reps: "AMRAP", load: "bodyweight", notes: "" },
                ],
                targetRPE: 7,
                durationMin: 75,
                notes: "",
              },
              {
                dayOfWeek: 2,
                type: "cardio",
                title: "Corsa 6km + strides",
                exercises: [],
                targetRPE: 6,
                durationMin: 40,
                notes: "Ultimi 400m a ritmo gara",
              },
              {
                dayOfWeek: 4,
                type: "strength",
                title: "Deadlift + Lower",
                exercises: [
                  { name: "Deadlift", sets: 4, reps: "4", load: "82.5% 1RM", notes: "" },
                  { name: "Romanian Deadlift", sets: 3, reps: "10", load: "62.5% 1RM", notes: "" },
                  { name: "Leg Press", sets: 3, reps: "12", load: "moderato", notes: "" },
                ],
                targetRPE: 7,
                durationMin: 70,
                notes: "",
              },
            ],
          },
        ],
      },
      {
        cycleNumber: 2,
        weeks: [
          {
            weekNumber: 1,
            sessions: [
              {
                dayOfWeek: 0,
                type: "strength",
                title: "Intensificazione Squat",
                exercises: [
                  { name: "Back Squat", sets: 5, reps: "3", load: "82.5% 1RM", notes: "" },
                  { name: "Panca Piana", sets: 4, reps: "5", load: "77.5% 1RM", notes: "" },
                ],
                targetRPE: 8,
                durationMin: 80,
                notes: "Fase di intensificazione",
              },
            ],
          },
        ],
      },
      {
        cycleNumber: 3,
        weeks: [
          {
            weekNumber: 1,
            sessions: [
              {
                dayOfWeek: 0,
                type: "strength",
                title: "Peak — Squat Max",
                exercises: [
                  { name: "Back Squat", sets: 1, reps: "1", load: "95-100% 1RM", notes: "Tentativo PR" },
                ],
                targetRPE: 10,
                durationMin: 90,
                notes: "Giornata di picco — riscaldamento progressivo lungo",
              },
            ],
          },
        ],
      },
    ],
  };

  const programRef = await addDoc(
    collection(db, "coaches", COACH_ID, "programs"),
    programData
  );
  console.log(`✅ Programma creato: ${programRef.id}`);

  // ── Mock AI analysis ─────────────────────────────────────────────────────────
  const mockAI: AIAnalysis = {
    summary: "Ottima sessione! Il RPE effettivo è in linea con il target e la durata è stata rispettata. La progressione è costante.",
    positives: ["RPE gestito perfettamente rispetto al target", "Durata nella finestra pianificata", "Umore e energia buoni"],
    suggestions: ["Considera di aumentare il carico dello squat della settimana prossima del 2.5%", "Idratazione: assicurati di bere abbastanza durante l'allenamento"],
    flags: [],
    nextSessionTip: "Per la prossima sessione di corsa punta a mantenere il ritmo conversazionale per tutto il percorso, senza strides finali.",
  };

  // ── 5 Logs di esempio ─────────────────────────────────────────────────────────
  const logsData: Omit<WorkoutLog, "id" | "createdAt">[] = [
    {
      date: Timestamp.fromDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
      programId: programRef.id,
      plannedSession: programData.cycles[0].weeks[0].sessions[0],
      actualDurationMin: 78,
      perceivedRPE: 7,
      mood: 4,
      energyLevel: 4,
      notes: "Buona sessione, squat fluido. Aumentato leggermente il carico.",
      aiAnalysis: mockAI,
    },
    {
      date: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
      programId: programRef.id,
      plannedSession: programData.cycles[0].weeks[0].sessions[1],
      actualDurationMin: 32,
      perceivedRPE: 5,
      mood: 3,
      energyLevel: 3,
      notes: "Gambe ancora un po' pesanti dallo squat di ieri.",
      aiAnalysis: {
        summary: "Corsa completata nel target RPE nonostante la fatica residua dall'allenamento precedente. Ottima gestione dello sforzo.",
        positives: ["Hai completato la sessione nonostante la fatica", "RPE rispettato"],
        suggestions: ["Considera un giorno di riposo attivo in più tra forza e corsa"],
        flags: ["Fatica residua rilevata — monitora il recupero"],
        nextSessionTip: "Prima della sessione di deadlift: 10 minuti di mobilità anche per la schiena.",
      },
    },
    {
      date: Timestamp.fromDate(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)),
      programId: programRef.id,
      plannedSession: programData.cycles[0].weeks[0].sessions[2],
      actualDurationMin: 72,
      perceivedRPE: 8,
      mood: 4,
      energyLevel: 3,
      notes: "Deadlift pesante oggi. RPE più alto del previsto, tecnica ok.",
      aiAnalysis: {
        summary: "Il RPE di 8 supera il target di 7, ma la sessione è stata portata a termine con tecnica corretta. Ottima resilienza mentale.",
        positives: ["Sessione completata nonostante sforzo maggiore del previsto", "Tecnica mantenuta sotto fatica"],
        suggestions: ["Nella prossima settimana considera di ridurre il carico del 5% per recuperare"],
        flags: ["RPE >target per 2 sessioni consecutive — valuta il recupero"],
        nextSessionTip: "Priorità alla qualità del sonno nei prossimi 2 giorni.",
      },
    },
    {
      date: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
      programId: programRef.id,
      plannedSession: programData.cycles[0].weeks[1].sessions[0],
      actualDurationMin: 75,
      perceivedRPE: 7,
      mood: 5,
      energyLevel: 5,
      notes: "Giornata eccezionale! PR personale nello squat. Tutto scorreva.",
      aiAnalysis: {
        summary: "Sessione di picco! PR nello squat con umore ed energia ai massimi. Questo è il risultato della progressione pianificata.",
        positives: ["PR personale raggiunto", "Umore ed energia al massimo (5/5)", "RPE perfettamente in target"],
        suggestions: [],
        flags: [],
        nextSessionTip: "Cavalca questa forma: la prossima sessione di corsa può essere leggermente più intensa.",
      },
    },
    {
      date: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
      date2: undefined,
      programId: programRef.id,
      plannedSession: programData.cycles[0].weeks[1].sessions[1],
      actualDurationMin: 40,
      perceivedRPE: 6,
      mood: 4,
      energyLevel: 4,
      notes: "Corsa ottima, strides finali fluidi.",
      aiAnalysis: mockAI,
    } as Omit<WorkoutLog, "id" | "createdAt">,
  ].map(({ date2, ...rest }) => rest) as Omit<WorkoutLog, "id" | "createdAt">[];

  for (const logData of logsData) {
    await addDoc(
      collection(db, "coaches", COACH_ID, "athletes", ATHLETE_ID, "logs"),
      { ...logData, createdAt: Timestamp.now() }
    );
  }
  console.log("✅ 5 log di esempio creati");

  console.log("\n🎉 Seed completato con successo!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Errore seed:", err);
  process.exit(1);
});
