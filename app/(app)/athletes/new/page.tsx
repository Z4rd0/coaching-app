"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim() || !email.trim()) {
      setError("Nome e email sono obbligatori");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/invite/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coachId: user.uid,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          sport: sport.trim(),
          goals: goals.trim(),
          notes: notes.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Errore nell'invio");
        return;
      }

      router.push("/athletes");
    } catch {
      setError("Errore di rete");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Invita atleta</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mario Rossi"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="atleta@email.com"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sport / disciplina</label>
            <input
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              placeholder="Es. Powerlifting, Running…"
              className={inputCls}
            />
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Obiettivi</label>
            <textarea
              rows={2}
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="Obiettivi dell'atleta…"
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Note private</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note visibili solo a te…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>
        )}

        <div className="bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700">
          <p className="text-xs text-slate-400">
            📧 L&apos;atleta riceverà un&apos;email con un link per creare il suo account e collegarsi a te.
            Il link scade dopo 7 giorni.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary disabled:opacity-60 text-white font-semibold py-3 rounded-xl"
        >
          {loading ? "Invio in corso…" : "Invia invito"}
        </button>
      </form>
    </div>
  );
}
