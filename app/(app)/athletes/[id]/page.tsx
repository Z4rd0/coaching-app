"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getAthlete, getAthletePrograms, getLogs, updateAthlete, deleteAthlete } from "@/lib/firestore";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
import type { Athlete, AthleteProgram, WorkoutLog } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary";

export default function AthleteDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [programs, setPrograms] = useState<AthleteProgram[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Edit form state
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [goals, setGoals] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getAthlete(user.uid, id),
      getAthletePrograms(user.uid, id),
      getLogs(user.uid, id, 5),
    ]).then(([a, p, l]) => {
      setAthlete(a);
      setPrograms(p);
      setLogs(l);
      if (a) {
        setName(a.name);
        setSport(a.sport ?? "");
        setGoals(a.goals ?? "");
        setNotes(a.notes ?? "");
      }
    }).finally(() => setLoading(false));
  }, [user, id]);

  const handleSave = async () => {
    if (!user || !athlete) return;
    setSaving(true);
    try {
      await updateAthlete(user.uid, id, { name, sport, goals, notes });
      setAthlete((prev) => prev ? { ...prev, name, sport, goals, notes } : prev);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const joinLink = athlete && athlete.status === "pending" && user
    ? `${APP_URL || (typeof window !== "undefined" ? window.location.origin : "")}/join/${user.uid}/${id}`
    : null;

  const handleCopyLink = () => {
    if (!joinLink) return;
    navigator.clipboard.writeText(joinLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await deleteAthlete(user.uid, id);
      router.replace("/athletes");
    } catch (err) {
      console.error("delete athlete:", err);
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!athlete) return (
    <div className="px-4 pt-6">
      <p className="text-slate-400">Atleta non trovato</p>
    </div>
  );

  // activeProgram intentionally unused — kept for future quick-start button
  // const activeProgram = programs.find((p) => p.isActive);

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{athlete.name}</h1>
          <p className="text-slate-400 text-xs">{athlete.email}</p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-slate-400 hover:text-white p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
      </div>

      {/* Status badge */}
      <div className="flex gap-2 items-center">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          athlete.status === "active" ? "bg-primary/20 text-primary" :
          athlete.status === "pending" ? "bg-blue-500/20 text-blue-400" :
          athlete.status === "invited" ? "bg-yellow-500/20 text-yellow-400" :
          "bg-slate-700 text-slate-400"
        }`}>
          {athlete.status === "active" ? "Attivo" :
           athlete.status === "pending" ? "Link inviato — in attesa" :
           athlete.status === "invited" ? "Invitato — in attesa" :
           "Archiviato"}
        </span>
        {athlete.sport && (
          <span className="text-xs text-slate-500">{athlete.sport}</span>
        )}
      </div>

      {/* Join link recovery (only for pending athletes) */}
      {joinLink && (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <div className="flex-1">
              <p className="text-white text-sm font-semibold">Link di invito</p>
              <p className="text-slate-400 text-xs">Invialo a {athlete.name} via WhatsApp, SMS o email</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 break-all font-mono bg-slate-900 rounded-lg px-3 py-2">
            {joinLink}
          </p>
          <button
            onClick={handleCopyLink}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
              linkCopied ? "bg-green-600 text-white" : "bg-primary text-white"
            }`}
          >
            {linkCopied ? "✓ Copiato!" : "Copia link"}
          </button>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sport</label>
            <input value={sport} onChange={(e) => setSport(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Obiettivi</label>
            <textarea rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Note private</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-slate-600 text-slate-400 rounded-xl text-sm">
              Annulla
            </button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              {saving ? "Salvo…" : "Salva"}
            </button>
          </div>
        </div>
      )}

      {/* Info cards */}
      {!editing && (athlete.goals || athlete.notes) && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          {athlete.goals && (
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Obiettivi</p>
              <p className="text-sm text-slate-300">{athlete.goals}</p>
            </div>
          )}
          {athlete.notes && (
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Note private</p>
              <p className="text-sm text-slate-300">{athlete.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Programs section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Programmi</h2>
          <Link
            href={`/athletes/${id}/programs/new`}
            className="text-primary text-xs font-medium"
          >
            + Nuovo
          </Link>
        </div>

        {programs.length === 0 ? (
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 text-center">
            <p className="text-slate-500 text-sm">Nessun programma assegnato</p>
            <Link href={`/athletes/${id}/programs/new`} className="text-primary text-xs mt-1 inline-block">
              Crea o assegna un programma →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {programs.map((p) => (
              <Link
                key={p.id}
                href={`/athletes/${id}/programs/${p.id}/edit`}
                className="flex items-center gap-3 bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${p.isActive ? "bg-primary" : "bg-slate-600"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  <p className="text-slate-500 text-xs">
                    {p.cycles.length} cicli · {p.sport || "—"} · {p.isActive ? "Attivo" : p.status}
                  </p>
                </div>
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent logs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Log recenti</h2>
        </div>

        {logs.length === 0 ? (
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 text-center">
            <p className="text-slate-500 text-sm">Nessun allenamento loggato</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm font-medium">
                    {format(log.date.toDate(), "EEE d MMM", { locale: it })}
                  </p>
                  <div className="flex gap-3 text-xs text-slate-400">
                    <span>RPE {log.perceivedRPE}</span>
                    <span>{log.actualDurationMin} min</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                      {log.writtenBy === "athlete" ? "Atleta" : "Coach"}
                    </span>
                  </div>
                </div>
                {log.notes && (
                  <p className="text-slate-500 text-xs mt-1 truncate">{log.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone: delete athlete */}
      <div className="pt-4 border-t border-slate-800">
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            Elimina atleta
          </button>
        ) : (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-3">
            <p className="text-white text-sm font-semibold">Eliminare {athlete.name}?</p>
            <p className="text-slate-400 text-xs">
              Verranno eliminati tutti i programmi, i log e i dati di questo atleta. Questa azione non può essere annullata.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-400 text-sm"
              >
                Annulla
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {deleting ? "Eliminazione…" : "Sì, elimina"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
