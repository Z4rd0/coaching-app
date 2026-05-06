"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getProgram, setActiveProgram, deleteProgram } from "@/lib/firestore";
import type { Program } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export default function ProgramDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!user || !program) return;
    if (!confirm(`Eliminare "${program.name}"? L'operazione non è reversibile.`)) return;
    setDeleting(true);
    await deleteProgram(user.uid, program.id);
    router.replace("/programs");
  };

  useEffect(() => {
    if (!user) return;
    getProgram(user.uid, id).then((p) => {
      setProgram(p);
      setLoading(false);
    });
  }, [user, id]);

  const handleActivate = async () => {
    if (!user || !program) return;
    setActivating(true);
    await setActiveProgram(user.uid, program.id);
    setProgram((prev) => prev ? { ...prev, isActive: true } : prev);
    setActivating(false);
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!program) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-slate-400">Programma non trovato</p>
    </div>
  );

  return (
    <div className="px-4 pt-6 pb-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {program.isActive && (
              <span className="text-xs bg-primary/20 text-primary-300 px-2 py-0.5 rounded-full font-medium">Attivo</span>
            )}
            <span className="text-xs text-slate-400">{program.sport}</span>
          </div>
          <h1 className="text-xl font-bold text-white truncate">{program.name}</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link href={`/programs/${id}/edit`} className="text-sm text-primary font-medium">
            Modifica
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-400 font-medium disabled:opacity-50"
          >
            {deleting ? "…" : "Elimina"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatMini label="Cicli" value={String(program.cycles.length)} />
        <StatMini
          label="Settimane"
          value={String(program.cycles.reduce((s, c) => s + c.weeks.length, 0))}
        />
        <StatMini
          label="Sessioni"
          value={String(
            program.cycles.reduce(
              (s, c) => s + c.weeks.reduce((ws, w) => ws + w.sessions.length, 0),
              0
            )
          )}
        />
      </div>

      {!program.isActive && (
        <button
          onClick={handleActivate}
          disabled={activating}
          className="w-full bg-primary text-white font-semibold py-3 rounded-xl disabled:opacity-60"
        >
          {activating ? "Attivazione…" : "Attiva questo programma"}
        </button>
      )}

      {/* Cycles and sessions */}
      {program.cycles.map((cycle) => (
        <section key={cycle.cycleNumber}>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Ciclo {cycle.cycleNumber}
          </h2>
          <div className="space-y-4">
            {cycle.weeks.map((week) => (
              <div key={week.weekNumber} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-slate-750 border-b border-slate-700">
                  <span className="text-sm font-semibold text-white">Settimana {week.weekNumber}</span>
                </div>
                {week.sessions.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-4">Nessuna sessione</p>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {week.sessions.map((session, si) => (
                      <div key={si} className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <span className="text-xs text-slate-400">{DAYS[session.dayOfWeek]} · </span>
                            <span className="text-xs text-primary-300">{SESSION_TYPE_LABELS[session.type]}</span>
                            <p className="text-sm font-medium text-white">{session.title || "—"}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-slate-400">RPE target</p>
                            <p className="text-lg font-bold text-primary">{session.targetRPE}</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mb-2">⏱ {session.durationMin} min</p>
                        {session.exercises.length > 0 && (
                          <ul className="space-y-1.5">
                            {session.exercises.map((ex, ei) => (
                              <li key={ei} className="text-xs text-slate-300">
                                <div className="flex gap-2 items-baseline">
                                  <span className="text-slate-500 shrink-0">{ei + 1}.</span>
                                  <span className="font-medium">{ex.name}</span>
                                  <span className="text-slate-500">{ex.sets}×{ex.reps}</span>
                                  {ex.load && <span className="text-slate-500">@ {ex.load}</span>}
                                  {ex.restSeconds && (
                                    <span className="text-slate-600">
                                      · {ex.restSeconds >= 60
                                          ? `${Math.floor(ex.restSeconds / 60)}m${ex.restSeconds % 60 ? (ex.restSeconds % 60) + "s" : ""}`
                                          : `${ex.restSeconds}s`} rec
                                    </span>
                                  )}
                                </div>
                                {ex.variants && (
                                  <p className="text-slate-500 mt-0.5 ml-4">↔ {ex.variants}</p>
                                )}
                                {ex.notes && (
                                  <p className="text-slate-500 mt-0.5 ml-4 italic">{ex.notes}</p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                        {session.notes && (
                          <p className="text-xs text-slate-500 mt-2 italic">{session.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
