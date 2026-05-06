"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createProgram } from "@/lib/firestore";
import type { Cycle } from "@/types";
import { emptyCycle } from "@/lib/programHelpers";
import ProgramBuilder from "@/components/ProgramBuilder";

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";

export default function NewProgramPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [startDate, setStartDate] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>([emptyCycle(1)]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) { setError("Inserisci il nome del programma"); return; }
    setSaving(true);
    setError("");
    try {
      await createProgram(user.uid, {
        name: name.trim(),
        sport: sport.trim(),
        cycles,
        isActive: false,
        ...(startDate ? { startDate } : {}),
      });
      router.push("/programs");
    } catch {
      setError("Errore nel salvataggio");
    } finally {
      setSaving(false);
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
        <h1 className="text-xl font-bold text-white">Nuovo programma</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info generali */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome programma</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Forza Base 12 settimane" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sport / disciplina</label>
            <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Es. Powerlifting, Running…" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data inizio (Lunedì settimana 1)</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Builder */}
        <ProgramBuilder cycles={cycles} onChange={setCycles} />

        {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

        <button type="submit" disabled={saving} className="w-full bg-primary disabled:opacity-60 text-white font-semibold py-3 rounded-xl">
          {saving ? "Salvataggio…" : "Salva programma"}
        </button>
      </form>
    </div>
  );
}
