"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createAthlete } from "@/lib/firestore";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";

export default function NewAthletePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sport, setSport] = useState("");
  const [goals, setGoals] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joinLink, setJoinLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) { setError("Il nome è obbligatorio"); return; }
    setLoading(true);
    setError("");

    try {
      // Create athlete profile client-side (coach is authenticated)
      const ref = await createAthlete(user.uid, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        sport: sport.trim(),
        goals: goals.trim(),
        notes: notes.trim(),
        status: "pending",
      });

      const link = `${APP_URL}/join/${user.uid}/${ref.id}`;
      setJoinLink(link);
    } catch (err: unknown) {
      console.error("createAthlete error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("permission-denied")) {
        setError("Permesso negato — riprova tra qualche secondo o ricarica la pagina.");
      } else if (msg.includes("offline") || msg.includes("unavailable")) {
        setError("Connessione assente — controlla la rete e riprova.");
      } else {
        setError(`Errore: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!joinLink) return;
    navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Step 2: show join link ─────────────────────────────────────────────────
  if (joinLink) {
    return (
      <div className="px-4 pt-6 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/athletes")} className="text-slate-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Profilo creato!</h1>
        </div>

        <div className="space-y-4">
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <p className="text-white font-semibold mb-1">Link di accesso per {name}</p>
            <p className="text-slate-400 text-sm">Invialo via WhatsApp, SMS o email</p>
          </div>

          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 mb-2 font-medium">Link di join</p>
            <p className="text-xs text-slate-300 break-all font-mono bg-slate-900 rounded-lg px-3 py-2">
              {joinLink}
            </p>
          </div>

          <button
            onClick={handleCopy}
            className={`w-full py-3 rounded-xl font-semibold transition-colors ${
              copied ? "bg-green-600 text-white" : "bg-primary text-white"
            }`}
          >
            {copied ? "✓ Copiato!" : "Copia link"}
          </button>

          <button
            onClick={() => router.push("/athletes")}
            className="w-full py-3 rounded-xl border border-slate-600 text-slate-400 text-sm"
          >
            Vai alla lista atleti
          </button>

          <div className="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700">
            <p className="text-xs text-slate-400">
              📱 L&apos;atleta apre il link, crea il suo account e viene collegato automaticamente al tuo profilo coach.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: form ───────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Aggiungi atleta</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Mario Rossi" required className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email (opzionale)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="atleta@email.com" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sport / disciplina</label>
            <input value={sport} onChange={(e) => setSport(e.target.value)}
              placeholder="Es. Powerlifting, Running…" className={inputCls} />
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Obiettivi</label>
            <textarea rows={2} value={goals} onChange={(e) => setGoals(e.target.value)}
              placeholder="Obiettivi dell'atleta…" className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Note private</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Note visibili solo a te…" className={`${inputCls} resize-none`} />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

        <div className="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700">
          <p className="text-xs text-slate-400">
            🔗 Dopo la creazione riceverai un link da inviare all&apos;atleta via WhatsApp o SMS. L&apos;atleta crea il suo account cliccando il link.
          </p>
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-primary disabled:opacity-60 text-white font-semibold py-3 rounded-xl">
          {loading ? "Creazione…" : "Crea profilo e genera link"}
        </button>
      </form>
    </div>
  );
}
