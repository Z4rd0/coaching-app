"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import {
  getActiveAthleteProgram,
  getLogs,
  getTodaySession,
  getGroupsForAthlete,
  getActiveGroupProgram,
} from "@/lib/firestore";
import type { AthleteProgram, GroupProgram, WorkoutLog } from "@/types";
import { SESSION_TYPE_LABELS, MOOD_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";

const SESSION_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  strength: { color: "#60A5FA", bg: "rgba(59,130,246,0.12)" },
  hiit:     { color: "#FB7185", bg: "rgba(244,63,94,0.12)" },
  cardio:   { color: "#FBBF24", bg: "rgba(245,158,11,0.12)" },
  circuit:  { color: "#FACC15", bg: "rgba(250,204,21,0.12)" },
};

export default function AthleteDashboardPage() {
  const { user, athleteAccess, signOut } = useAuth();
  const router = useRouter();
  const [program, setProgram] = useState<AthleteProgram | null>(null);
  const [groupPrograms, setGroupPrograms] = useState<(GroupProgram & { groupName: string })[]>([]);
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"solo" | "group">("solo");
  const [stravaStatus, setStravaStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("strava");
    if (p === "connected") setStravaStatus("connected");
    else if (p === "error" || p === "denied") setStravaStatus("error");
  }, []);

  const connectStrava = async () => {
    if (!user) return;
    setStravaStatus("connecting");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/strava/auth", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { url, error } = await res.json();
      if (error || !url) { setStravaStatus("error"); return; }
      window.location.href = url;
    } catch {
      setStravaStatus("error");
    }
  };

  useEffect(() => {
    if (!user || !athleteAccess) return;
    const { coachId, athleteId } = athleteAccess;
    Promise.all([
      getActiveAthleteProgram(coachId, athleteId),
      getLogs(coachId, athleteId, 5),
      getGroupsForAthlete(coachId, user.uid).then((groups) =>
        Promise.all(
          groups.map(async (g) => {
            const p = await getActiveGroupProgram(coachId, g.id);
            return p ? { ...p, groupName: g.name } : null;
          })
        ).then((res) => res.filter((p): p is GroupProgram & { groupName: string } => p !== null))
      ),
    ]).then(([prog, logs, gProgs]) => {
      setProgram(prog);
      setRecentLogs(logs);
      setGroupPrograms(gProgs);
    }).finally(() => setLoading(false));
  }, [user, athleteAccess]);

  const todaySession = program ? getTodaySession(program) : null;
  const todayGroupSessions = groupPrograms
    .map((p) => ({ groupName: p.groupName, programName: p.name, session: getTodaySession(p) }))
    .filter((g) => g.session !== null);

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekLogs = recentLogs.filter((l) => l.date.toMillis() > oneWeekAgo);
  const avgRPE =
    weekLogs.length > 0
      ? (weekLogs.reduce((s, l) => s + l.perceivedRPE, 0) / weekLogs.length).toFixed(1)
      : "—";

  const handleSignOut = async () => {
    document.cookie = "coach-auth=; path=/; max-age=0";
    await signOut();
    router.replace("/auth");
  };

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="px-5 pt-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] capitalize" style={{ color: "var(--text-muted)" }}>
            {format(new Date(), "EEEE d MMMM", { locale: it })}
          </p>
          <h1 className="text-[24px] font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>
            Ciao 👋
          </h1>
        </div>
        <button
          onClick={handleSignOut}
          className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60"
          style={{ background: "var(--bg-surface-2)" }}
          aria-label="Esci"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
          </svg>
        </button>
      </div>

      {/* Segmented control */}
      {groupPrograms.length > 0 && (
        <div
          className="flex p-1 rounded-xl"
          style={{ background: "var(--bg-surface-1)" }}
        >
          {([["solo", "Solo"], ["group", "Gruppo 👥"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all"
              style={
                view === v
                  ? { background: "var(--green-primary)", color: "#fff" }
                  : { background: "transparent", color: "var(--text-muted)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Solo view */}
      {view === "solo" && (
        <>
          {/* Today's session */}
          {program ? (
            <TodaySessionCard
              title={program.name}
              session={todaySession}
              href="/athlete/log"
            />
          ) : (
            <div className="card px-4 py-5 text-center">
              <p className="text-[14px] mb-2" style={{ color: "var(--text-muted)" }}>
                Nessun programma attivo.
              </p>
              <p className="text-[12px]" style={{ color: "var(--text-faint)" }}>
                Il tuo coach ti assegnerà presto un programma.
              </p>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="card px-4 py-4 flex flex-col items-center gap-1">
              <span className="text-[28px] font-black tabular leading-none" style={{ color: "var(--text-primary)" }}>
                {weekLogs.length}
              </span>
              <span className="text-[11px] text-center" style={{ color: "var(--text-faint)" }}>
                Sessioni questa settimana
              </span>
            </div>
            <div className="card px-4 py-4 flex flex-col items-center gap-1">
              <span className="text-[28px] font-black tabular leading-none" style={{ color: "var(--text-primary)" }}>
                {avgRPE}
              </span>
              <span className="text-[11px] text-center" style={{ color: "var(--text-faint)" }}>
                RPE medio
              </span>
            </div>
          </div>
        </>
      )}

      {/* Group view */}
      {view === "group" && (
        <>
          {todayGroupSessions.length > 0 ? (
            todayGroupSessions.map((g) => (
              <TodaySessionCard
                key={`${g.groupName}-${g.programName}`}
                title={`👥 ${g.groupName}`}
                session={g.session}
                href="/athlete/log"
              />
            ))
          ) : (
            <div className="card px-4 py-5 text-center">
              <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
                Nessuna sessione di gruppo oggi
              </p>
            </div>
          )}
          <Link
            href="/athlete/group"
            className="block text-center py-3 rounded-xl text-[14px] font-semibold transition-opacity active:opacity-70"
            style={{ background: "var(--bg-surface-2)", color: "var(--green-primary)", border: "1px solid var(--green-border)" }}
          >
            Vedi classifica gruppo →
          </Link>
        </>
      )}

      {/* Strava connect */}
      <StravaConnectCard status={stravaStatus} onConnect={connectStrava} />

      {/* Recent logs */}
      {recentLogs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-label">Ultimi allenamenti</h2>
            <Link href="/athlete/history" className="text-[12px] font-semibold" style={{ color: "var(--green-primary)" }}>
              Tutti →
            </Link>
          </div>
          <div className="space-y-2">
            {recentLogs.slice(0, 3).map((log) => {
              const tc = SESSION_TYPE_COLORS[log.plannedSession?.type ?? ""] ?? SESSION_TYPE_COLORS.strength;
              return (
                <div key={log.id} className="card-2 flex items-center gap-3 px-4 py-3">
                  <span className="text-xl">{MOOD_LABELS[log.mood]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {format(log.date.toDate(), "EEE d MMM", { locale: it })}
                    </p>
                    {log.notes && (
                      <p className="text-[12px] truncate mt-0.5" style={{ color: "var(--text-faint)" }}>
                        {log.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-[13px] font-black tabular" style={{ color: tc.color }}>
                      RPE {log.perceivedRPE}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {log.actualDurationMin} min
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="h-4" />
    </div>
  );
}

function TodaySessionCard({
  title,
  session,
  href,
}: {
  title: string;
  session: ReturnType<typeof getTodaySession>;
  href: string;
}) {
  const tc = session
    ? (SESSION_TYPE_COLORS[session.type] ?? SESSION_TYPE_COLORS.strength)
    : null;

  return (
    <div
      className="card-hero overflow-hidden"
      style={{ border: `1px solid ${tc?.bg ?? "var(--border-default)"}` }}
    >
      <div className="px-4 pt-4 pb-2">
        <p className="section-label mb-2">{title}</p>
        {session ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ background: tc?.bg, color: tc?.color }}
                >
                  {SESSION_TYPE_LABELS[session.type]}
                </span>
                {session.title && (
                  <h3 className="text-[17px] font-bold mt-1.5 truncate" style={{ color: "var(--text-primary)" }}>
                    {session.title}
                  </h3>
                )}
                <p className="text-[12px] mt-1" style={{ color: "var(--text-muted)" }}>
                  {session.exercises.length} esercizi · {session.durationMin} min · RPE {session.targetRPE}
                </p>
              </div>
              <div className="shrink-0 flex flex-col items-end">
                <p className="text-[10px] font-medium uppercase" style={{ color: "var(--text-faint)" }}>RPE</p>
                <p className="text-[28px] font-black tabular leading-none" style={{ color: tc?.color }}>
                  {session.targetRPE}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-[13px] py-2" style={{ color: "var(--text-muted)" }}>
            Nessuna sessione programmata oggi 🛌
          </p>
        )}
      </div>
      <div className="px-4 pb-4">
        <Link
          href={href}
          className="block w-full text-center text-white font-bold py-3 rounded-xl text-[15px] transition-opacity active:opacity-80"
          style={{ background: tc?.color ?? "var(--green-primary)" }}
        >
          {session ? "Inizia allenamento" : "Logga comunque"}
        </Link>
      </div>
    </div>
  );
}

function StravaConnectCard({
  status,
  onConnect,
}: {
  status: "idle" | "connecting" | "connected" | "error";
  onConnect: () => void;
}) {
  if (status === "connected") {
    return (
      <div
        className="card flex items-center gap-3 px-4 py-3"
        style={{ borderColor: "rgba(252,76,2,0.2)" }}
      >
        <StravaLogo />
        <p className="flex-1 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Strava connesso
        </p>
        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(252,76,2,0.12)", color: "#FC4C02" }}>
          ✓ Attivo
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onConnect}
      disabled={status === "connecting"}
      className="card w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-70 transition-opacity disabled:opacity-50"
      style={{ borderColor: "rgba(252,76,2,0.15)" }}
    >
      <StravaLogo />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {status === "connecting" ? "Connessione in corso…" : "Connetti Strava"}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
          {status === "error"
            ? "Connessione fallita. Riprova."
            : "Importa automaticamente dati FC, distanza e calorie"}
        </p>
      </div>
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-faint)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function StravaLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#FC4C02" />
      <path d="M17 28l-5-9h4l1 2 1-2h4l-5 9z" fill="white" opacity="0.6" />
      <path d="M23 28l-5-9h4l5 9h-4z" fill="white" />
    </svg>
  );
}
