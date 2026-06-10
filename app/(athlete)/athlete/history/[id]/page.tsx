"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getLog } from "@/lib/firestore";
import type { WorkoutLog } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import LogEditModal from "@/components/LogEditModal";
import LogDetailBody from "@/components/LogDetailBody";

export default function AthleteLogDetailPage() {
  const { user, athleteAccess } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!user || !athleteAccess) return;
    const { coachId, athleteId } = athleteAccess;
    getLog(coachId, athleteId, id).then((data) => {
      setLog(data);
      setLoading(false);
    });
  }, [user, athleteAccess, id]);

  const handleSaveEdit = async (patch: {
    dateISO: string;
    actualDurationMin: number;
    perceivedRPE: number;
    mood: number;
    energyLevel: number;
    notes: string;
  }) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    const res = await fetch("/api/update-log", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ logId: id, patch }),
    });
    if (!res.ok) throw new Error("update failed");
    setLog((prev) => prev ? {
      ...prev,
      date: Timestamp.fromDate(new Date(patch.dateISO + "T12:00:00")),
      actualDurationMin: patch.actualDurationMin,
      perceivedRPE: patch.perceivedRPE,
      mood: patch.mood,
      energyLevel: patch.energyLevel,
      notes: patch.notes,
    } : prev);
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    setActionError("");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/delete-log", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ logId: id }),
      });
      if (!res.ok) throw new Error("delete failed");
      router.push("/athlete/history");
    } catch {
      setActionError("Errore nell'eliminazione");
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!log) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-slate-400">Log non trovato</p>
    </div>
  );

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push("/athlete/history")} className="text-slate-400 mt-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 capitalize">
            {format(log.date.toDate(), "EEEE d MMMM yyyy", { locale: it })}
          </p>
          <h1 className="text-xl font-bold text-white">
            {log.plannedSession?.title || "Sessione libera"}
          </h1>
          {log.plannedSession && (
            <span className="text-xs text-slate-400">{SESSION_TYPE_LABELS[log.plannedSession.type]}</span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-slate-400 hover:text-primary p-2"
            title="Modifica"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-slate-400 hover:text-red-400 p-2"
            title="Elimina"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-3">
          <p className="text-red-400 text-sm font-medium">Eliminare questo log?</p>
          <p className="text-slate-400 text-xs">
            Verrà rimosso anche dal feed di tutti i tuoi gruppi e dalla classifica. Non si può annullare.
          </p>
          {actionError && <p className="text-red-400 text-xs">{actionError}</p>}
          <div className="flex gap-2">
            <button onClick={() => setConfirmingDelete(false)} className="flex-1 py-2 border border-slate-600 text-slate-400 rounded-xl text-sm">
              Annulla
            </button>
            <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              {deleting ? "Elimino…" : "Elimina"}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <LogEditModal log={log} onClose={() => setEditing(false)} onSave={handleSaveEdit} />
      )}

      <LogDetailBody log={log} />
    </div>
  );
}
