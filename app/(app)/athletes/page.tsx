"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getAthletes } from "@/lib/firestore";
import type { Athlete } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

const STATUS_COLOR: Record<Athlete["status"], string> = {
  pending: "bg-blue-500/20 text-blue-400",
  active: "bg-primary/20 text-primary",
  invited: "bg-yellow-500/20 text-yellow-400",
  archived: "bg-slate-700 text-slate-400",
};
const STATUS_LABEL: Record<Athlete["status"], string> = {
  pending: "In attesa",
  active: "Attivo",
  invited: "Invitato",
  archived: "Archiviato",
};

export default function AthletesPage() {
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getAthletes(user.uid)
      .then(setAthletes)
      .finally(() => setLoading(false));
  }, [user]);

  const active = athletes.filter((a) => a.status === "active");
  const invited = athletes.filter((a) => a.status === "invited");
  const archived = athletes.filter((a) => a.status === "archived");

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Atleti</h1>
        <Link
          href="/athletes/new"
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Invita
        </Link>
      </div>

      {athletes.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">Nessun atleta ancora</p>
          <Link href="/athletes/new" className="inline-block text-primary text-sm font-medium">
            Invita il tuo primo atleta →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <Section title="Attivi" athletes={active} />
          )}
          {invited.length > 0 && (
            <Section title="In attesa" athletes={invited} />
          )}
          {archived.length > 0 && (
            <Section title="Archiviati" athletes={archived} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, athletes }: { title: string; athletes: Athlete[] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-2">
        {athletes.map((a) => (
          <Link
            key={a.id}
            href={`/athletes/${a.id}`}
            className="flex items-center gap-3 bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700 hover:border-slate-600 transition-colors"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary font-bold text-sm">
                {a.name.charAt(0).toUpperCase()}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{a.name}</p>
              <p className="text-slate-500 text-xs truncate">{a.sport || a.email}</p>
            </div>

            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[a.status]}`}>
              {STATUS_LABEL[a.status]}
            </span>

            <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
