"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getPrograms, setActiveProgram } from "@/lib/firestore";
import type { Program } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function ProgramsPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const data = await getPrograms(user.uid);
    setPrograms(data);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [user]);

  const handleActivate = async (id: string) => {
    if (!user) return;
    setActivating(id);
    await setActiveProgram(user.uid, id);
    await load();
    setActivating(null);
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-4 pt-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Programmi</h1>
        <div className="flex gap-2">
          <Link
            href="/programs/import"
            className="bg-slate-700 text-slate-200 text-sm font-semibold px-3 py-2 rounded-xl"
          >
            📄 Import PDF
          </Link>
          <Link
            href="/programs/new"
            className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl"
          >
            + Nuovo
          </Link>
        </div>
      </div>

      {programs.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-slate-400 mb-4">Nessun programma ancora</p>
          <Link href="/programs/new" className="text-primary font-medium">
            Crea il primo programma →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map((prog) => (
            <div
              key={prog.id}
              className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"
            >
              <Link href={`/programs/${prog.id}`} className="block p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {prog.isActive && (
                        <span className="text-xs bg-primary/20 text-primary-300 px-2 py-0.5 rounded-full font-medium">
                          Attivo
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{prog.sport}</span>
                    </div>
                    <h3 className="text-base font-semibold text-white">{prog.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {prog.cycles.length} cicli ·{" "}
                      {prog.cycles.reduce((s, c) => s + c.weeks.length, 0)} settimane
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-slate-500 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Creato il {format(prog.createdAt.toDate(), "d MMM yyyy", { locale: it })}
                </p>
              </Link>
              {!prog.isActive && (
                <div className="border-t border-slate-700 px-4 py-2">
                  <button
                    onClick={() => handleActivate(prog.id)}
                    disabled={activating === prog.id}
                    className="text-sm text-primary font-medium disabled:opacity-50"
                  >
                    {activating === prog.id ? "Attivazione…" : "Attiva programma"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
