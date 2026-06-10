"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getGroup,
  getGroupPrograms,
  getGroupFeed,
  getAthletes,
  addAthleteToGroup,
  removeAthleteFromGroup,
} from "@/lib/firestore";
import type { Group, GroupProgram, GroupFeedEntry, Athlete } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import GroupActivity from "@/components/GroupActivity";

export default function GroupDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id: groupId } = useParams<{ id: string }>();

  const [group, setGroup] = useState<Group | null>(null);
  const [programs, setPrograms] = useState<GroupProgram[]>([]);
  const [feed, setFeed] = useState<GroupFeedEntry[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleCopyLink = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/join-group/${user.uid}/${groupId}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Impossibile copiare il link");
    }
  };

  const reload = useCallback(async () => {
    if (!user) return;
    const [g, progs, entries, all] = await Promise.all([
      getGroup(user.uid, groupId),
      getGroupPrograms(user.uid, groupId),
      getGroupFeed(user.uid, groupId),
      getAthletes(user.uid),
    ]);
    setGroup(g);
    setPrograms(progs);
    setFeed(entries);
    setAthletes(all.filter((a) => a.status !== "archived"));
  }, [user, groupId]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const handleAdd = async (athlete: Athlete) => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await addAthleteToGroup(user.uid, groupId, athlete);
      await reload();
      setShowAdd(false);
    } catch {
      setError("Errore nell'aggiunta dell'atleta");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (athlete: Athlete) => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await removeAthleteFromGroup(user.uid, groupId, athlete);
      await reload();
    } catch {
      setError("Errore nella rimozione dell'atleta");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/delete-group", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ groupId }),
      });
      if (!res.ok) throw new Error("delete failed");
      router.push("/groups");
    } catch {
      setError("Errore nell'eliminazione del gruppo");
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  if (!group) {
    return (
      <div className="px-4 pt-16 text-center">
        <p className="text-slate-400 text-sm">Gruppo non trovato.</p>
        <Link href="/groups" className="text-primary text-sm mt-2 inline-block">← Torna ai gruppi</Link>
      </div>
    );
  }

  const members = athletes.filter((a) => group.memberIds.includes(a.id));
  const candidates = athletes.filter((a) => !group.memberIds.includes(a.id));

  return (
    <div className="px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/groups")} className="text-slate-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{group.name}</h1>
          <p className="text-xs text-slate-400">
            {members.length} {members.length === 1 ? "atleta" : "atleti"}
            {group.sport ? ` · ${group.sport}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => setShowDelete(true)} className="text-red-400 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>

      {/* Delete confirm */}
      {showDelete && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 space-y-3">
          <p className="text-red-400 text-sm font-medium">Eliminare questo gruppo?</p>
          <p className="text-slate-400 text-xs">
            Verranno eliminati anche i programmi del gruppo. Gli atleti e i loro log non verranno toccati.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setShowDelete(false)} className="flex-1 py-2 border border-slate-600 text-slate-400 rounded-xl text-sm">
              Annulla
            </button>
            <button onClick={handleDelete} disabled={busy} className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
              Elimina
            </button>
          </div>
        </div>
      )}

      {group.description && (
        <p className="text-slate-400 text-sm bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700 mb-6">
          {group.description}
        </p>
      )}

      {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {/* Invite link */}
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 mb-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Link d&apos;invito
        </p>
        <p className="text-slate-400 text-xs mb-3">
          Chi apre il link entra nel gruppo: chi ha già un account accede e si unisce,
          chi non ce l&apos;ha si registra (anche con Google) e viene aggiunto automaticamente.
        </p>
        <button
          type="button"
          onClick={handleCopyLink}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            copied
              ? "bg-primary/20 text-primary border border-primary/40"
              : "bg-primary text-white"
          }`}
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Link copiato!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
              Copia link d&apos;invito
            </>
          )}
        </button>
      </div>

      {/* Programs */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Programmi del gruppo</p>
          <Link href={`/groups/${groupId}/programs/new`} className="text-primary text-xs font-medium">
            + Nuovo
          </Link>
        </div>
        {programs.length === 0 ? (
          <div className="bg-slate-800 rounded-2xl px-4 py-5 border border-slate-700 text-center">
            <p className="text-slate-400 text-sm">Nessun programma assegnato al gruppo.</p>
            <Link href={`/groups/${groupId}/programs/new`} className="text-primary text-xs mt-1 inline-block">
              Assegna un programma →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {programs.map((p) => (
              <Link
                key={p.id}
                href={`/groups/${groupId}/programs/${p.id}/edit`}
                className="flex items-center gap-3 bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5M3.75 6.75h16.5M3.75 17.25h16.5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  <p className="text-slate-500 text-xs">
                    {p.cycles.length} cicli · {p.cycles.reduce((a, c) => a + c.weeks.length, 0)} settimane
                  </p>
                </div>
                {p.isActive && (
                  <span className="bg-primary/20 text-primary text-xs font-medium px-2 py-0.5 rounded-full shrink-0">
                    Attivo
                  </span>
                )}
                <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Activity: all-time leaderboard + recent feed */}
      <div className="mb-6">
        <GroupActivity entries={feed} stats={group.stats} />
      </div>

      {/* Members */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Membri</p>
          {candidates.length > 0 && (
            <button type="button" onClick={() => setShowAdd((v) => !v)} className="text-primary text-xs font-medium">
              {showAdd ? "Chiudi" : "+ Aggiungi"}
            </button>
          )}
        </div>

        {/* Add member picker */}
        {showAdd && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 mb-3 divide-y divide-slate-700/50 overflow-hidden">
            {candidates.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={busy}
                onClick={() => handleAdd(a)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/30 transition-colors disabled:opacity-60"
              >
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-xs">{a.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{a.name}</p>
                  <p className="text-slate-500 text-xs truncate">
                    {a.sport || a.email}
                    {!a.athleteUid && " · non ancora attivo"}
                  </p>
                </div>
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            ))}
          </div>
        )}

        {members.length === 0 ? (
          <p className="text-slate-500 text-sm bg-slate-800 rounded-2xl px-4 py-4 border border-slate-700">
            Nessun membro nel gruppo.
          </p>
        ) : (
          <div className="space-y-2">
            {members.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700"
              >
                <Link href={`/athletes/${a.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-sm">{a.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{a.name}</p>
                    <p className="text-slate-500 text-xs truncate">
                      {a.sport || a.email}
                      {!a.athleteUid && " · non ancora attivo"}
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleRemove(a)}
                  className="text-slate-500 hover:text-red-400 p-1 shrink-0 transition-colors disabled:opacity-60"
                  title="Rimuovi dal gruppo"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
