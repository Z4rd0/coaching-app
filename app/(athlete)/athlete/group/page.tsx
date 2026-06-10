"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getGroupsForAthlete, getGroupFeed } from "@/lib/firestore";
import type { Group, GroupFeedEntry } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import GroupActivity from "@/components/GroupActivity";

export default function AthleteGroupPage() {
  const { user, athleteAccess } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Group | null>(null);
  const [feed, setFeed] = useState<GroupFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);

  useEffect(() => {
    if (!user || !athleteAccess) return;
    getGroupsForAthlete(athleteAccess.coachId, user.uid)
      .then((grps) => {
        setGroups(grps);
        setSelected(grps[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, [user, athleteAccess]);

  useEffect(() => {
    if (!selected || !athleteAccess) return;
    setFeedLoading(true);
    getGroupFeed(athleteAccess.coachId, selected.id)
      .then(setFeed)
      .finally(() => setFeedLoading(false));
  }, [selected, athleteAccess]);

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  if (groups.length === 0) {
    return (
      <div className="px-4 pt-6 pb-8">
        <h1 className="text-xl font-bold text-white mb-4">Gruppo</h1>
        <div className="text-center py-16 space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="text-slate-400 text-sm">Non fai ancora parte di un gruppo.</p>
          <p className="text-slate-500 text-xs">Il tuo coach può aggiungerti a un gruppo di allenamento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-white mb-1">
        {groups.length === 1 ? `👥 ${groups[0].name}` : "I miei gruppi"}
      </h1>
      {selected && (
        <p className="text-slate-400 text-xs mb-4">
          {selected.memberIds.length} {selected.memberIds.length === 1 ? "atleta" : "atleti"}
          {selected.sport ? ` · ${selected.sport}` : ""}
        </p>
      )}

      {/* Group selector */}
      {groups.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelected(g)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                selected?.id === g.id
                  ? "bg-primary border-primary text-white"
                  : "border-slate-600 text-slate-400"
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {feedLoading ? (
        <LoadingSpinner className="py-16" />
      ) : (
        <GroupActivity entries={feed} stats={selected?.stats} highlightUid={user?.uid} />
      )}

      <Link
        href="/athlete/log"
        className="mt-6 block w-full text-center bg-primary text-white font-semibold py-3 rounded-xl text-sm"
      >
        Logga un allenamento 💪
      </Link>
    </div>
  );
}
