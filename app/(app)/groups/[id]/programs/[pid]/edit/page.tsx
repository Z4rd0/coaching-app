"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getGroup,
  getGroupProgram,
  updateGroupProgram,
  deleteGroupProgram,
  setActiveGroupProgram,
} from "@/lib/firestore";
import type { Cycle, Group, GroupProgram } from "@/types";
import { emptyCycle } from "@/lib/programHelpers";
import LoadingSpinner from "@/components/LoadingSpinner";
import ProgramBuilder from "@/components/ProgramBuilder";

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";

export default function EditGroupProgramPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id: groupId, pid: programId } = useParams<{ id: string; pid: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<Group | null>(null);

  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [startDate, setStartDate] = useState("");
  const [cycles, setCycles] = useState<Cycle[]>([emptyCycle(1)]);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<GroupProgram["status"]>("active");

  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getGroup(user.uid, groupId),
      getGroupProgram(user.uid, groupId, programId),
    ]).then(([g, p]) => {
      setGroup(g);
      if (p) {
        setName(p.name);
        setSport(p.sport ?? "");
        setStartDate(p.startDate ?? "");
        setCycles(p.cycles);
        setIsActive(p.isActive ?? false);
        setStatus(p.status);
      }
    }).finally(() => setLoading(false));
  }, [user, groupId, programId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) { setError("Inserisci il nome del programma"); return; }
    setSaving(true);
    setError("");
    try {
      await updateGroupProgram(user.uid, groupId, programId, {
        name: name.trim(),
        sport: sport.trim(),
        cycles,
        status,
        ...(startDate ? { startDate } : {}),
      });
      if (isActive) {
        await setActiveGroupProgram(user.uid, groupId, programId);
      }
      router.push(`/groups/${groupId}`);
    } catch {
      setError("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await deleteGroupProgram(user.uid, groupId, programId);
      router.push(`/groups/${groupId}`);
    } catch {
      setError("Errore nell'eliminazione");
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
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Modifica programma</h1>
          {group && <p className="text-xs text-slate-400">gruppo {group.name} — le modifiche sono visibili a tutti i membri</p>}
        </div>
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="text-red-400 p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>

      {/* Delete confirm */}
      {showDelete && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 space-y-3">
          <p className="text-red-400 text-sm font-medium">Eliminare questo programma?</p>
          <p className="text-slate-400 text-xs">Verrà rimosso per tutti i membri del gruppo. Questa azione non può essere annullata.</p>
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="flex-1 py-2 border border-slate-600 text-slate-400 rounded-xl text-sm">
              Annulla
            </button>
            <button onClick={handleDelete} disabled={saving} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              Elimina
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
            <label className="block text-xs text-slate-400 mb-1">Data inizio</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Stato</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as GroupProgram["status"])}
              className={inputCls}
            >
              <option value="active">Attivo</option>
              <option value="paused">In pausa</option>
              <option value="completed">Completato</option>
            </select>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-slate-300">Programma corrente del gruppo</span>
          </label>
        </div>

        <ProgramBuilder cycles={cycles} onChange={setCycles} />

        {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary disabled:opacity-60 text-white font-semibold py-3 rounded-xl"
        >
          {saving ? "Salvataggio…" : "Salva modifiche"}
        </button>
      </form>
    </div>
  );
}
