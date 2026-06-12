"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getGroups } from "@/lib/firestore";
import type { Group } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getGroups(user.uid)
      .then(setGroups)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-5 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--text-primary)" }}>Gruppi</h1>
        <Link
          href="/groups/new"
          className="flex items-center gap-1.5 text-white text-[13px] font-semibold px-4 py-2 rounded-xl"
          style={{ background: "var(--green-primary)" }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nuovo
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "var(--bg-surface-2)" }}
          >
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="var(--text-faint)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>Nessun gruppo ancora</p>
          <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>
            Crea un gruppo per assegnare lo stesso programma a più atleti.
          </p>
          <Link href="/groups/new" className="text-[14px] font-semibold" style={{ color: "var(--green-primary)" }}>
            Crea il tuo primo gruppo →
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y" style={{ borderColor: "var(--border-default)" }}>
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="flex items-center gap-3 px-4 py-3 active:opacity-70 transition-opacity"
              style={{ borderBottom: "1px solid var(--border-default)" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--green-subtle)" }}
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--green-primary)" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {g.name}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                  {g.memberIds.length} {g.memberIds.length === 1 ? "atleta" : "atleti"}
                  {g.sport ? ` · ${g.sport}` : ""}
                </p>
              </div>

              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--text-faintest)" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
