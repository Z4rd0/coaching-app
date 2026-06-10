"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPrograms,
  getGroup,
  copyProgramToGroup,
  createGroupProgram,
  setActiveGroupProgram,
} from "@/lib/firestore";
import { emptyCycle } from "@/lib/programHelpers";
import type { Program, Group, Cycle } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import ProgramBuilder from "@/components/ProgramBuilder";

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";

type Flow = "pick" | "build";

export default function NewGroupProgramPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id: groupId } = useParams<{ id: string }>();

  const [flow, setFlow] = useState<Flow>("pick");
  const [group, setGroup] = useState<Group | null>(null);
  const [templates, setTemplates] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Build-from-scratch form
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [startDate, setStartDate] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>([emptyCycle(1)]);
  const [makeActive, setMakeActive] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getGroup(user.uid, groupId),
      getPrograms(user.uid),
    ]).then(([g, t]) => {
      setGroup(g);
      setTemplates(t);
      if (g) setSport(g.sport ?? "");
    }).finally(() => setLoading(false));
  }, [user, groupId]);

  const handleCopyTemplate = async (template: Program) => {
    if (!user) return;
    setSaving(true);
    try {
      const ref = await copyProgramToGroup(user.uid, groupId, template);
      if (makeActive) await setActiveGroupProgram(user.uid, groupId, ref.id);
      router.push(`/groups/${groupId}`);
    } catch {
      setError("Errore nella copia");
      setSaving(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) { setError("Inserisci il nome del programma"); return; }
    setSaving(true);
    setError("");
    try {
      const ref = await createGroupProgram(user.uid, groupId, {
        name: name.trim(),
        sport: sport.trim(),
        cycles,
        status: "active",
        isActive: makeActive,
        ...(startDate ? { startDate } : {}),
      });
      if (makeActive) await setActiveGroupProgram(user.uid, groupId, ref.id);
      router.push(`/groups/${groupId}`);
    } catch {
      setError("Errore nel salvataggio");
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-4 pt-6 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Nuovo programma di gruppo</h1>
          {group && <p className="text-xs text-slate-400">per {group.name} — visibile a tutti i membri</p>}
        </div>
      </div>

      {/* Flow switcher */}
      <div className="flex bg-slate-800 rounded-xl p-1 mb-6">
        {([["pick", "Copia da libreria"], ["build", "Crea da zero"]] as [Flow, string][]).map(([f, label]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFlow(f)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              flow === f ? "bg-primary text-white" : "text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Copy from library */}
      {flow === "pick" && (
        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-slate-400 text-sm mb-2">Nessun programma in libreria</p>
              <button
                type="button"
                onClick={() => setFlow("build")}
                className="text-primary text-sm"
              >
                Crea da zero →
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-1">
                Scegli un template dalla tua libreria — tutti i membri di {group?.name} vedranno lo stesso programma.
              </p>
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={saving}
                  onClick={() => handleCopyTemplate(t)}
                  className="w-full flex items-center gap-3 bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700 hover:border-primary/50 transition-colors text-left disabled:opacity-60"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M3.75 6.75h16.5M3.75 17.25h16.5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.cycles.length} cicli · {t.sport || "—"}</p>
                  </div>
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}

              {/* Active toggle */}
              <label className="flex items-center gap-3 bg-slate-800 rounded-xl px-4 py-3 border border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={makeActive}
                  onChange={(e) => setMakeActive(e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm text-slate-300">Imposta come programma attivo del gruppo</span>
              </label>
            </>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      )}

      {/* Build from scratch */}
      {flow === "build" && (
        <form onSubmit={handleCreate} className="space-y-6">
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Nome programma</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome programma" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Sport / disciplina</label>
              <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Es. Powerlifting…" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data inizio (Lunedì settimana 1)</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={makeActive}
                onChange={(e) => setMakeActive(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm text-slate-300">Imposta come programma attivo del gruppo</span>
            </label>
          </div>

          <ProgramBuilder cycles={cycles} onChange={setCycles} />

          {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary disabled:opacity-60 text-white font-semibold py-3 rounded-xl"
          >
            {saving ? "Salvataggio…" : "Crea programma"}
          </button>
        </form>
      )}
    </div>
  );
}
