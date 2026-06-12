"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getAthletes } from "@/lib/firestore";
import type { Athlete } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import Avatar from "@/components/Avatar";

const STATUS_STYLES: Record<Athlete["status"], { color: string; bg: string; label: string }> = {
  active:   { color: "var(--green-primary)",  bg: "var(--green-subtle)",              label: "Attivo" },
  pending:  { color: "#60A5FA",               bg: "rgba(96,165,250,0.12)",            label: "In attesa" },
  invited:  { color: "#FBBF24",               bg: "rgba(245,158,11,0.12)",            label: "Invitato" },
  archived: { color: "var(--text-faint)",     bg: "rgba(148,163,184,0.08)",           label: "Archiviato" },
};

export default function AthletesPage() {
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getAthletes(user.uid)
      .then(setAthletes)
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = athletes.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  );

  const active   = filtered.filter((a) => a.status === "active");
  const pending  = filtered.filter((a) => a.status === "pending" || a.status === "invited");
  const archived = filtered.filter((a) => a.status === "archived");

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-5 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>Atleti</h1>
        <Link
          href="/athletes/new"
          className="flex items-center gap-1.5 text-white text-[13px] font-semibold px-4 py-2 rounded-xl"
          style={{ background: "var(--green-primary)" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Invita
        </Link>
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-5"
        style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)" }}
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-faint)" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="search"
          placeholder="Cerca atleta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-[14px] outline-none"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "var(--bg-surface-2)" }}
          >
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--text-faint)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
            {search ? "Nessun atleta trovato" : "Nessun atleta ancora"}
          </p>
          {!search && (
            <Link href="/athletes/new" className="text-[14px] font-semibold" style={{ color: "var(--green-primary)" }}>
              Invita il tuo primo atleta →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <Section title="Attivi" badge={{ count: active.length, color: "var(--green-primary)", bg: "var(--green-subtle)" }} athletes={active} />
          )}
          {pending.length > 0 && (
            <Section title="In attesa" badge={{ count: pending.length, color: "#60A5FA", bg: "rgba(96,165,250,0.12)" }} athletes={pending} />
          )}
          {archived.length > 0 && (
            <Section title="Archiviati" badge={{ count: archived.length, color: "var(--text-faint)", bg: "rgba(148,163,184,0.08)" }} athletes={archived} />
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  badge,
  athletes,
}: {
  title: string;
  badge: { count: number; color: string; bg: string };
  athletes: Athlete[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="section-label">{title}</p>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ color: badge.color, background: badge.bg }}
        >
          {badge.count}
        </span>
      </div>
      <div className="card overflow-hidden divide-y" style={{ borderColor: "var(--border-default)" }}>
        {athletes.map((a) => {
          const st = STATUS_STYLES[a.status];
          const isArchived = a.status === "archived";
          return (
            <Link
              key={a.id}
              href={`/athletes/${a.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-opacity active:opacity-70"
              style={{
                borderBottom: "1px solid var(--border-default)",
                opacity: isArchived ? 0.6 : 1,
              }}
            >
              <Avatar name={a.name} size={38} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {a.name}
                </p>
                <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--text-faint)" }}>
                  {a.sport || a.email}
                </p>
              </div>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{ color: st.color, background: st.bg }}
              >
                {st.label}
              </span>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--text-faintest)" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
