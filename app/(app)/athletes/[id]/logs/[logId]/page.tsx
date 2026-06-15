"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getAthlete, getLog, updateLogComment } from "@/lib/firestore";
import type { Athlete, WorkoutLog } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import LogDetailBody from "@/components/LogDetailBody";
import { buildSingleLogExport } from "@/lib/exportLogs";

// ─── Coach-facing detail of a single athlete log ────────────────────────────────
// Mirrors the athlete's own /athlete/history/[id] page but reads the log under the
// coach → athlete path and lets the coach write/edit feedback inline.

export default function AthleteLogDetailPage() {
  const { user } = useAuth();
  const { id, logId } = useParams<{ id: string; logId: string }>();
  const router = useRouter();

  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingComment, setEditingComment] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getAthlete(user.uid, id),
      getLog(user.uid, id, logId),
    ]).then(([a, l]) => {
      setAthlete(a);
      setLog(l);
      setCommentText(l?.coachComment ?? "");
      setLoading(false);
    });
  }, [user, id, logId]);

  const handleSaveComment = async () => {
    if (!user) return;
    setSavingComment(true);
    try {
      const trimmed = commentText.trim();
      await updateLogComment(user.uid, id, logId, trimmed);
      setLog((prev) => (prev ? { ...prev, coachComment: trimmed } : prev));
      setEditingComment(false);
    } finally {
      setSavingComment(false);
    }
  };

  const handleCopy = async () => {
    if (!log || !athlete) return;
    await navigator.clipboard.writeText(buildSingleLogExport(log, athlete));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <button onClick={() => router.back()} className="text-slate-400 mt-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          {athlete && <p className="text-xs text-primary font-medium">{athlete.name}</p>}
          <p className="text-xs text-slate-400 capitalize">
            {format(log.date.toDate(), "EEEE d MMMM yyyy", { locale: it })}
          </p>
          <h1 className="text-xl font-bold text-white">
            {log.plannedSession?.title || "Sessione libera"}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            {log.plannedSession && (
              <span className="text-xs text-slate-400">{SESSION_TYPE_LABELS[log.plannedSession.type]}</span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
              {log.writtenBy === "athlete" ? "Loggato dall’atleta" : "Loggato dal coach"}
            </span>
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-primary p-2 shrink-0"
          title="Copia sessione per Claude"
        >
          {copied ? (
            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>

      <LogDetailBody log={log} hideCoachComment />

      {/* Coach comment editor */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs font-semibold text-primary">💬 Feedback per l’atleta</p>
        {editingComment ? (
          <div className="space-y-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              placeholder="Scrivi un feedback per l'atleta…"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setEditingComment(false); setCommentText(log.coachComment ?? ""); }}
                className="flex-1 py-2 border border-slate-600 text-slate-400 rounded-xl text-sm"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={savingComment}
                onClick={handleSaveComment}
                className="flex-1 py-2 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-60"
              >
                {savingComment ? "Salvo…" : "Salva"}
              </button>
            </div>
          </div>
        ) : log.coachComment ? (
          <button
            type="button"
            onClick={() => { setEditingComment(true); setCommentText(log.coachComment ?? ""); }}
            className="w-full text-left"
          >
            <p className="text-sm text-slate-200">{log.coachComment}</p>
            <p className="text-xs text-primary mt-1">Modifica</p>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setEditingComment(true); setCommentText(""); }}
            className="text-sm text-slate-400 hover:text-primary transition-colors"
          >
            + Aggiungi un commento
          </button>
        )}
      </div>
    </div>
  );
}
