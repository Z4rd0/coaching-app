"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createProgram } from "@/lib/firestore";
import type { Program } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

type Tab = "json" | "pdf";
type Step = "upload" | "preview" | "saving";

const AI_PROMPT = `Analizza il programma di allenamento che ti fornisco e convertilo nel seguente formato JSON.
Restituisci SOLO il JSON, senza testo prima o dopo.

Struttura richiesta:
{
  "name": "Nome del programma",
  "sport": "Sport/disciplina",
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
              "title": "Nome sessione",
              "targetRPE": 7,
              "durationMin": 60,
              "notes": "",
              "exercises": [
                { "name": "Esercizio", "sets": 3, "reps": "8", "load": "70%", "notes": "" }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Regole:
- dayOfWeek: 0=Lun, 1=Mar, 2=Mer, 3=Gio, 4=Ven, 5=Sab, 6=Dom
- type: "strength" | "cardio" | "mobility" | "rest" | "other"
- reps è sempre una stringa (es. "8", "8-10", "AMRAP")
- sets è un numero intero
- Se non c'è RPE usa 7, se non c'è durata stima ~5 min per esercizio

Ecco il programma:
[INCOLLA QUI IL TUO PROGRAMMA]`;

export default function ImportProgramPage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>("json");
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Omit<Program, "id" | "createdAt"> | null>(null);
  const [copied, setCopied] = useState(false);

  // PDF state
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fileName, setFileName] = useState("");

  // ── JSON import (client-side, no API) ────────────────────────────────────────

  const handleJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        validateAndPreview(parsed);
      } catch {
        setError("File JSON non valido — controlla la sintassi");
      }
    };
    reader.readAsText(file);
  };

  const validateAndPreview = (parsed: unknown) => {
    setError("");
    const p = parsed as { name?: string; cycles?: unknown[] };
    if (!p?.name || !Array.isArray(p?.cycles)) {
      setError('Il JSON deve avere "name" e "cycles". Scarica il template per vedere la struttura corretta.');
      return;
    }
    setPreview({ ...(parsed as Omit<Program, "id" | "createdAt">), isActive: false });
    setStep("preview");
  };

  // ── PDF import (via API + Claude) ────────────────────────────────────────────

  const analyzePdf = async (file: File) => {
    setAnalyzing(true);
    setError("");
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const idToken = await user?.getIdToken();
      const res = await fetch("/api/import-program", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Errore nell'analisi");
        setAnalyzing(false);
        return;
      }
      setPreview({ ...data.program, isActive: false });
      setStep("preview");
    } catch {
      setError("Errore di rete");
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) analyzePdf(file);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!user || !preview) return;
    setStep("saving");
    try {
      const ref = await createProgram(user.uid, preview);
      router.push(`/programs/${ref.id}`);
    } catch {
      setError("Errore nel salvataggio");
      setStep("preview");
    }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Importa programma</h1>
          <p className="text-xs text-slate-400">Scegli il metodo di importazione</p>
        </div>
      </div>

      {step === "upload" && (
        <>
          {/* Tab switcher */}
          <div className="flex bg-slate-800 rounded-xl p-1">
            <button
              onClick={() => { setTab("json"); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "json" ? "bg-primary text-white" : "text-slate-400"}`}
            >
              📋 Template JSON
            </button>
            <button
              onClick={() => { setTab("pdf"); setError(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "pdf" ? "bg-primary text-white" : "text-slate-400"}`}
            >
              📄 PDF con AI
            </button>
          </div>

          {/* ── JSON TAB ── */}
          {tab === "json" && (
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Passo 1 — Scarica il template</p>
                <p className="text-sm text-slate-300">
                  Scarica il file JSON di esempio, aprilo con un editor di testo e compilalo con il tuo programma.
                </p>
                <a
                  href="/program-template.json"
                  download="program-template.json"
                  className="flex items-center justify-center gap-2 w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
                >
                  ⬇️ Scarica template.json
                </a>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Passo 2 — Oppure usa Claude/ChatGPT</p>
                <p className="text-sm text-slate-300">
                  Copia il prompt qui sotto, incollalo su Claude.ai o ChatGPT con il testo del tuo programma, e salva il JSON che ti restituisce.
                </p>
                <button
                  onClick={copyPrompt}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                    copied
                      ? "bg-primary/20 border-primary text-primary-300"
                      : "bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                  }`}
                >
                  {copied ? "✓ Prompt copiato!" : "📋 Copia prompt per AI"}
                </button>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Passo 3 — Carica il JSON</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-600 hover:border-primary/50 rounded-xl py-6 text-center transition-colors"
                >
                  <p className="text-2xl mb-1">📂</p>
                  <p className="text-sm font-medium text-white">Seleziona file JSON</p>
                  <p className="text-xs text-slate-500 mt-0.5">program-template.json o il file generato dall&apos;AI</p>
                </button>
                <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleJsonFile} />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm whitespace-pre-wrap">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── PDF TAB ── */}
          {tab === "pdf" && (
            <div className="space-y-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
                <p className="text-xs text-yellow-400 font-semibold mb-1">⚠️ Richiede API Key Anthropic</p>
                <p className="text-xs text-slate-400">Imposta ANTHROPIC_API_KEY nelle variabili d&apos;ambiente Vercel per usare questa funzione.</p>
              </div>

              <div
                onClick={() => !analyzing && pdfRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handlePdfDrop}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                  dragOver ? "border-primary bg-primary/5" : "border-slate-600 hover:border-primary/50"
                }`}
              >
                {analyzing ? (
                  <div className="space-y-3">
                    <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-slate-300">Claude sta analizzando il PDF…</p>
                    <p className="text-xs text-slate-500">{fileName}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-4xl">📄</p>
                    <p className="text-sm font-medium text-white">Trascina un PDF qui</p>
                    <p className="text-xs text-slate-400">oppure clicca per scegliere</p>
                  </div>
                )}
              </div>
              <input ref={pdfRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) analyzePdf(f); }} />

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── PREVIEW ── */}
      {step === "preview" && preview && (
        <>
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
            <p className="text-xs text-primary-300 font-semibold mb-1">✓ Programma pronto</p>
            <p className="text-white font-bold text-lg">{preview.name}</p>
            <p className="text-slate-400 text-sm">{preview.sport}</p>
            <div className="flex gap-4 mt-2 text-xs text-slate-400">
              <span>{preview.cycles.length} cicli</span>
              <span>{preview.cycles.reduce((s, c) => s + c.weeks.length, 0)} settimane</span>
              <span>{preview.cycles.reduce((s, c) => s + c.weeks.reduce((ws, w) => ws + w.sessions.length, 0), 0)} sessioni</span>
            </div>
          </div>

          <div className="space-y-3">
            {preview.cycles.map((cycle) => (
              <div key={cycle.cycleNumber}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ciclo {cycle.cycleNumber}</p>
                {cycle.weeks.map((week) => (
                  <div key={week.weekNumber} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden mb-2">
                    <div className="px-4 py-2 border-b border-slate-700">
                      <span className="text-sm font-semibold text-white">Settimana {week.weekNumber}</span>
                    </div>
                    {week.sessions.map((session, si) => (
                      <div key={si} className="px-4 py-3 border-b border-slate-700 last:border-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{DAYS[session.dayOfWeek]}</span>
                            <span className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">
                              {SESSION_TYPE_LABELS[session.type]}
                            </span>
                          </div>
                          <span className="text-xs text-primary font-medium">RPE {session.targetRPE} · {session.durationMin}min</span>
                        </div>
                        <p className="text-sm font-medium text-white">{session.title}</p>
                        {session.exercises.length > 0 && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {session.exercises.slice(0, 3).map(e => e.name).join(", ")}
                            {session.exercises.length > 3 && ` +${session.exercises.length - 3}`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setStep("upload"); setPreview(null); setError(""); }}
              className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 font-semibold py-3 rounded-xl"
            >
              Indietro
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-primary text-white font-semibold py-3 rounded-xl"
            >
              Salva programma
            </button>
          </div>
        </>
      )}

      {step === "saving" && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Salvataggio…</p>
        </div>
      )}
    </div>
  );
}
