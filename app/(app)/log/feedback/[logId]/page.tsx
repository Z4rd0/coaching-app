"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getLog } from "@/lib/firestore";
import type { WorkoutLog } from "@/types";
import { MOOD_LABELS, ENERGY_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function FeedbackPage() {
  const { user } = useAuth();
  const { logId } = useParams<{ logId: string }>();
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    if (!user) return;

    let attempts = 0;
    const maxAttempts = 12; // poll for up to ~24 seconds

    const poll = async () => {
      const data = await getLog(user.uid, user.uid, logId);
      setLog(data);
      if (data?.aiAnalysis || attempts >= maxAttempts) {
        setPolling(false);
        setLoading(false);
      } else {
        attempts++;
        setTimeout(poll, 2000);
      }
    };

    poll();
  }, [user, logId]);

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!log) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-slate-400">Log non trovato</p>
    </div>
  );

  const ai = log.aiAnalysis;

  return (
    <div className="px-4 pt-6 pb-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white mb-1">
          {log.plannedSession?.title || "Sessione libera"}
        </h1>
        <div className="flex gap-4 text-sm text-slate-400">
          <span>⏱ {log.actualDurationMin} min</span>
          <span>RPE {log.perceivedRPE}/10</span>
          <span>{MOOD_LABELS[log.mood]} {ENERGY_LABELS[log.energyLevel]}</span>
        </div>
      </div>

      {/* AI Analysis */}
      {polling && !ai && (
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 text-center">
          <div className="flex items-center justify-center gap-2 text-primary mb-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Analisi AI in corso…</span>
          </div>
          <p className="text-xs text-slate-500">Claude sta elaborando il tuo allenamento</p>
        </div>
      )}

      {!polling && !ai && (
        <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
          <p className="text-sm text-slate-400 text-center">
            Analisi AI non disponibile per questo log.
          </p>
        </div>
      )}

      {ai && (
        <>
          {/* Summary */}
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">✨</span>
              <span className="text-sm font-semibold text-primary-300">Analisi AI</span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed">{ai.summary}</p>
          </div>

          {/* Positives */}
          {ai.positives.length > 0 && (
            <AISection title="Punti positivi" emoji="✅" items={ai.positives} color="green" />
          )}

          {/* Suggestions */}
          {ai.suggestions.length > 0 && (
            <AISection title="Suggerimenti" emoji="💡" items={ai.suggestions} color="yellow" />
          )}

          {/* Flags */}
          {ai.flags.length > 0 && (
            <AISection title="Attenzione" emoji="⚠️" items={ai.flags} color="red" />
          )}

          {/* Next session tip */}
          {ai.nextSessionTip && (
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
              <p className="text-xs font-semibold text-slate-400 mb-1">💬 Consiglio per la prossima sessione</p>
              <p className="text-sm text-slate-200">{ai.nextSessionTip}</p>
            </div>
          )}
        </>
      )}

      {/* Notes */}
      {log.notes && (
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
          <p className="text-xs font-semibold text-slate-400 mb-1">Note</p>
          <p className="text-sm text-slate-300">{log.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Link
          href="/"
          className="flex-1 text-center bg-primary text-white font-semibold py-3 rounded-xl"
        >
          Torna alla home
        </Link>
        <Link
          href="/history"
          className="flex-1 text-center bg-slate-800 border border-slate-700 text-slate-300 font-semibold py-3 rounded-xl"
        >
          Storico
        </Link>
      </div>
    </div>
  );
}

function AISection({
  title,
  emoji,
  items,
  color,
}: {
  title: string;
  emoji: string;
  items: string[];
  color: "green" | "yellow" | "red";
}) {
  const borderColor = { green: "border-green-500/30", yellow: "border-yellow-500/30", red: "border-red-500/30" }[color];
  const bgColor = { green: "bg-green-500/10", yellow: "bg-yellow-500/10", red: "bg-red-500/10" }[color];
  const textColor = { green: "text-green-400", yellow: "text-yellow-400", red: "text-red-400" }[color];

  return (
    <div className={`${bgColor} ${borderColor} border rounded-2xl p-4`}>
      <p className={`text-xs font-semibold ${textColor} mb-2`}>
        {emoji} {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-slate-200 flex gap-2">
            <span className="text-slate-500 shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
