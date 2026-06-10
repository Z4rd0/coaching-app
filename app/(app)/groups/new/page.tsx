"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getAthletes, createGroup } from "@/lib/firestore";
import type { Athlete } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";

export default function NewGroupPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    getAthletes(user.uid)
      .then((all) => setAthletes(all.filter((a) => a.status !== "archived")))
      .finally(() => setLoading(false));
  }, [user]);

  const toggleAthlete = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) { setError("Inserisci il nome del gruppo"); return; }
    setSaving(true);
    setError("");
    try {
      const members = athletes.filter((a) => selectedIds.has(a.id));
      const ref = await createGroup(user.uid, {
        name: name.trim(),
        sport: sport.trim(),
        description: description.trim(),
        memberIds: members.map((a) => a.id),
        memberUids: members
          .map((a) => a.athleteUid)
          .filter((uid): uid is string => Boolean(uid)),
      });
      router.push(`/groups/${ref.id}`);
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
        <h1 className="text-xl font-bold text-white">Nuovo gruppo</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome gruppo</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Gruppo gara primavera" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sport / disciplina</label>
            <input value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Es. Corsa, CrossFit…" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Descrizione (opzionale)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Obiettivi del gruppo…" className={inputCls} />
          </div>
        </div>

        {/* Member selection */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Atleti ({selectedIds.size} selezionati)
          </p>
          {athletes.length === 0 ? (
            <p className="text-slate-500 text-sm bg-slate-800 rounded-2xl px-4 py-4 border border-slate-700">
              Nessun atleta disponibile. Puoi aggiungere atleti al gruppo anche in seguito.
            </p>
          ) : (
            <div className="space-y-2">
              {athletes.map((a) => {
                const selected = selectedIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAthlete(a.id)}
                    className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 border text-left transition-colors ${
                      selected
                        ? "bg-primary/10 border-primary/50"
                        : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-sm">
                        {a.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{a.name}</p>
                      <p className="text-slate-500 text-xs truncate">
                        {a.sport || a.email}
                        {!a.athleteUid && " · non ancora attivo"}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                      selected ? "bg-primary border-primary" : "border-slate-600"
                    }`}>
                      {selected && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary disabled:opacity-60 text-white font-semibold py-3 rounded-xl"
        >
          {saving ? "Salvataggio…" : "Crea gruppo"}
        </button>
      </form>
    </div>
  );
}
