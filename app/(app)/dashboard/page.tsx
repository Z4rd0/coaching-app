"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveProgram, getLogs, getTodaySession, getUpcomingSessions, getAthletesAdherence } from "@/lib/firestore";
import type { AthleteAdherence, UpcomingSession } from "@/lib/firestore";
import type { Program, Session, WorkoutLog } from "@/types";
import { SESSION_TYPE_LABELS, MOOD_LABELS } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import Avatar from "@/components/Avatar";
import Link from "next/link";

const SESSION_TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  strength: { color: "#60A5FA", bg: "rgba(59,130,246,0.12)" },
  hiit:     { color: "#FB7185", bg: "rgba(244,63,94,0.12)" },
  cardio:   { color: "#FBBF24", bg: "rgba(245,158,11,0.12)" },
  circuit:  { color: "#FACC15", bg: "rgba(250,204,21,0.12)" },
  mobility: { color: "#34D399", bg: "rgba(52,211,153,0.12)" },
  rest:     { color: "#94A3B8", bg: "rgba(148,163,184,0.12)" },
  other:    { color: "#A78BFA", bg: "rgba(167,139,250,0.12)" },
};

type View = "coach" | "personal";

export default function DashboardPage() {
  const { user, coach, signOut } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<View>("coach");
  const [program, setProgram] = useState<Program | null>(null);
  const [recentLogs, setRecentLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionExpanded, setSessionExpanded] = useState(false);
  const [adherence, setAdherence] = useState<AthleteAdherence[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getActiveProgram(user.uid),
      getLogs(user.uid, user.uid, 5),
      getAthletesAdherence(user.uid).catch(() => [] as AthleteAdherence[]),
    ]).then(([prog, logs, adh]) => {
      setProgram(prog);
      setRecentLogs(logs);
      setAdherence(adh);
    }).finally(() => setLoading(false));
  }, [user]);

  const todaySession = program ? getTodaySession(program) : null;
  // Next sessions starting tomorrow (today is already shown above). 14-day horizon
  // covers the rest of the current week plus the start of the next.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const upcoming = program ? getUpcomingSessions(program, 14, tomorrow) : [];

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

  const sessionColors = todaySession ? (SESSION_TYPE_COLORS[todaySession.type] ?? SESSION_TYPE_COLORS.strength) : null;

  return (
    <div className="px-5 pt-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] capitalize" style={{ color: "var(--text-muted)" }}>
            {format(new Date(), "EEEE d MMMM", { locale: it })}
          </p>
          <h1 className="text-[24px] font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>
            Ciao, {coach?.name?.split(" ")[0] || "Coach"} 👋
          </h1>
        </div>
        <button
          onClick={handleSignOut}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity active:opacity-60"
          style={{ background: "var(--bg-surface-2)" }}
          aria-label="Esci"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
          </svg>
        </button>
      </div>

      {/* Segmented switch */}
      <div
        className="flex p-[3px] rounded-[12px] gap-[3px]"
        style={{ background: "var(--bg-surface-1)" }}
      >
        {(["coach", "personal"] as View[]).map((v) => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex-1 py-2 rounded-[10px] text-[13px] font-semibold transition-all duration-150"
              style={{
                background: active ? "var(--green-primary)" : "transparent",
                color: active ? "#fff" : "var(--text-muted)",
              }}
            >
              {v === "coach" ? "Coach" : "Il mio allenamento"}
            </button>
          );
        })}
      </div>

      {/* ── COACH VIEW ── */}
      {view === "coach" && (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard label="Atleti attivi" value={String(adherence.filter(a => daysSince(a.lastLogDate) < 7).length)} />
            <StatCard label="Sessioni sett." value={String(weekLogs.length)} />
            <StatCard
              label="Da monitorare"
              value={String(adherence.filter(a => daysSince(a.lastLogDate) >= 5).length)}
              valueColor="var(--status-error, #EF4444)"
            />
          </div>

          {adherence.length > 0 ? (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-label">I tuoi atleti</h2>
                <Link href="/athletes" className="text-[12px] font-semibold" style={{ color: "var(--green-primary)" }}>
                  Tutti →
                </Link>
              </div>
              <div className="card overflow-hidden">
                {[...adherence]
                  .sort((a, b) =>
                    daysSince(a.lastLogDate) === daysSince(b.lastLogDate)
                      ? a.weekSessions - b.weekSessions
                      : daysSince(b.lastLogDate) - daysSince(a.lastLogDate)
                  )
                  .map(({ athlete, weekSessions, lastLogDate }) => {
                    const days = daysSince(lastLogDate);
                    const inactive = days >= 5;
                    return (
                      <Link
                        key={athlete.id}
                        href={`/athletes/${athlete.id}`}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: "1px solid var(--border-default)" }}
                      >
                        <div className="relative shrink-0">
                          <Avatar name={athlete.name} size={36} />
                          {inactive && (
                            <span
                              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full animate-pulse-dot"
                              style={{ background: "#EF4444", border: "2px solid var(--bg-surface-1)" }}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {athlete.name}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                            {weekSessions} {weekSessions === 1 ? "sessione" : "sessioni"} questa settimana
                          </p>
                        </div>
                        <p
                          className="text-[12px] shrink-0 font-medium"
                          style={{ color: inactive ? "#EF4444" : "var(--text-faint)" }}
                        >
                          {lastLogDate === null
                            ? "mai loggato"
                            : days === 0 ? "oggi"
                            : days === 1 ? "ieri"
                            : `${days} gg fa`}
                        </p>
                      </Link>
                    );
                  })}
              </div>
            </section>
          ) : (
            <div className="card px-4 py-8 text-center">
              <p className="text-[14px] mb-3" style={{ color: "var(--text-muted)" }}>Nessun atleta ancora</p>
              <Link href="/athletes" className="text-[14px] font-semibold" style={{ color: "var(--green-primary)" }}>
                Aggiungi atleti →
              </Link>
            </div>
          )}
        </>
      )}

      {/* ── PERSONAL VIEW ── */}
      {view === "personal" && (
        <>
          {program && (
            <Link
              href={`/programs/${program.id}`}
              className="card-2 flex items-center gap-3 px-4 py-3 active:opacity-80 transition-opacity"
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(29,158,117,0.14)" }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="var(--green-primary)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
                  Programma attivo
                </p>
                <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {program.name}
                </p>
              </div>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--text-faintest)" strokeWidth={2} className="shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}

          <section>
            <h2 className="section-label mb-3">Sessione di oggi</h2>

            {todaySession ? (
              <div className="card-hero overflow-hidden" style={{ border: `1px solid ${sessionColors?.bg ?? "var(--border-default)"}` }}>
                <div
                  className="px-4 pt-4 pb-3 cursor-pointer active:opacity-80 transition-opacity"
                  onClick={() => setSessionExpanded((v) => !v)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ background: sessionColors?.bg, color: sessionColors?.color }}
                      >
                        {SESSION_TYPE_LABELS[todaySession.type]}
                      </span>
                      <h3 className="text-[17px] font-bold mt-1.5 truncate" style={{ color: "var(--text-primary)" }}>
                        {todaySession.title}
                      </h3>
                      <div className="flex gap-4 mt-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                        <span>⏱ {todaySession.durationMin} min</span>
                        <span>💪 {todaySession.exercises.length} esercizi</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <p className="text-[10px] font-medium uppercase" style={{ color: "var(--text-faint)" }}>RPE</p>
                      <p className="text-[28px] font-black tabular leading-none" style={{ color: sessionColors?.color ?? "var(--green-primary)" }}>
                        {todaySession.targetRPE}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-center mt-2">
                    <svg
                      width="16" height="16"
                      className={`transition-transform duration-200 ${sessionExpanded ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="var(--text-faintest)" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {sessionExpanded && todaySession.exercises.length > 0 && (
                  <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid var(--border-default)" }}>
                    {todaySession.exercises.map((ex, i) => (
                      <div key={i} className="flex items-baseline gap-2 text-[13px]">
                        <span className="shrink-0 w-5 text-right" style={{ color: "var(--text-faintest)" }}>{i + 1}.</span>
                        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{ex.name}</span>
                        <span style={{ color: "var(--text-faint)" }}>{ex.sets}×{ex.reps}</span>
                        {ex.load && <span style={{ color: "var(--text-faint)" }}>@ {ex.load}</span>}
                        {ex.restSeconds && (
                          <span className="ml-auto shrink-0 text-[11px]" style={{ color: "var(--text-faintest)" }}>
                            {ex.restSeconds >= 60
                              ? `${Math.floor(ex.restSeconds / 60)}m${ex.restSeconds % 60 ? (ex.restSeconds % 60) + "s" : ""}`
                              : `${ex.restSeconds}s`} rec
                          </span>
                        )}
                      </div>
                    ))}
                    {todaySession.notes && (
                      <p className="text-[12px] italic mt-2 pt-2" style={{ borderTop: "1px solid var(--border-default)", color: "var(--text-faint)" }}>
                        {todaySession.notes}
                      </p>
                    )}
                  </div>
                )}

                <div className="px-4 pb-4 pt-1">
                  <Link
                    href="/log"
                    className="block w-full text-center text-white font-bold py-3 rounded-xl text-[15px] transition-opacity active:opacity-80"
                    style={{ background: sessionColors?.color ?? "var(--green-primary)" }}
                  >
                    Registra allenamento
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card px-4 py-5 text-center">
                {program ? (
                  <>
                    <p className="text-[14px] mb-3" style={{ color: "var(--text-muted)" }}>
                      Nessuna sessione programmata oggi 🎉
                    </p>
                    <Link href="/log" className="text-[14px] font-semibold" style={{ color: "var(--green-primary)" }}>
                      Log sessione libera →
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-[14px] mb-3" style={{ color: "var(--text-muted)" }}>
                      Nessun programma attivo
                    </p>
                    <Link href="/programs" className="text-[14px] font-semibold" style={{ color: "var(--green-primary)" }}>
                      Crea un programma →
                    </Link>
                  </>
                )}
              </div>
            )}
          </section>

          {upcoming.length > 0 && (
            <section>
              <h2 className="section-label mb-3">Prossimi giorni</h2>
              <div className="space-y-2">
                {upcoming.map(({ date, session }) => (
                  <UpcomingRow key={date.toISOString()} date={date} session={session} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="section-label mb-3">Questa settimana</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard label="Allenamenti" value={String(weekLogs.length)} />
              <StatCard label="RPE medio" value={String(avgRPE)} />
            </div>
          </section>

          {recentLogs.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-label">Ultimi log</h2>
                <Link href="/history" className="text-[12px] font-semibold" style={{ color: "var(--green-primary)" }}>
                  Vedi tutti →
                </Link>
              </div>
              <div className="space-y-2">
                {recentLogs.slice(0, 3).map((log) => {
                  const tc = SESSION_TYPE_COLORS[log.plannedSession?.type ?? ""] ?? SESSION_TYPE_COLORS.strength;
                  return (
                    <Link
                      key={log.id}
                      href={`/history/${log.id}`}
                      className="flex items-center gap-3 card-2 px-4 py-3 active:opacity-80 transition-opacity"
                    >
                      <span className="text-xl">{MOOD_LABELS[log.mood]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {log.plannedSession?.title || "Sessione libera"}
                        </p>
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                          {format(log.date.toDate(), "d MMM", { locale: it })} · {log.actualDurationMin} min
                        </p>
                      </div>
                      <span className="text-[13px] font-black tabular shrink-0" style={{ color: tc.color }}>
                        {log.perceivedRPE}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <div className="h-4" />
    </div>
  );
}

function daysSince(d: Date | null): number {
  if (!d) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function UpcomingRow({ date, session }: { date: Date; session: Session }) {
  const [open, setOpen] = useState(false);
  const tc = SESSION_TYPE_COLORS[session.type] ?? SESSION_TYPE_COLORS.strength;
  const hasDetail = session.exercises.length > 0 || !!session.notes;
  const meta = [
    session.durationMin > 0 ? `⏱ ${session.durationMin} min` : null,
    session.exercises.length > 0 ? `💪 ${session.exercises.length} esercizi` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="card-2 overflow-hidden">
      <button
        onClick={() => hasDetail && setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-opacity active:opacity-80"
      >
        <div className="flex flex-col items-center justify-center shrink-0 w-10">
          <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--text-faint)" }}>
            {format(date, "EEE", { locale: it })}
          </span>
          <span className="text-[19px] font-black tabular leading-none mt-0.5" style={{ color: "var(--text-primary)" }}>
            {format(date, "d")}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: tc.bg, color: tc.color }}
          >
            {SESSION_TYPE_LABELS[session.type]}
          </span>
          <p className="text-[14px] font-medium truncate mt-1" style={{ color: "var(--text-primary)" }}>
            {session.title}
          </p>
          {meta && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
              {meta}
            </p>
          )}
        </div>
        {hasDetail && (
          <svg
            width="14" height="14"
            className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="var(--text-faintest)" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2" style={{ borderTop: "1px solid var(--border-default)" }}>
          {session.exercises.map((ex, i) => (
            <div key={i} className="flex items-baseline gap-2 text-[13px]">
              <span className="shrink-0 w-5 text-right" style={{ color: "var(--text-faintest)" }}>{i + 1}.</span>
              <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{ex.name}</span>
              {ex.reps && <span style={{ color: "var(--text-faint)" }}>{ex.sets}×{ex.reps}</span>}
              {ex.load && <span style={{ color: "var(--text-faint)" }}>@ {ex.load}</span>}
            </div>
          ))}
          {session.notes && (
            <p className="text-[12px] italic mt-1 pt-2" style={{ borderTop: session.exercises.length > 0 ? "1px solid var(--border-default)" : "none", color: "var(--text-faint)" }}>
              {session.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="card px-4 py-4 flex flex-col items-center justify-center gap-1 text-center">
      <span className="text-[28px] font-black tabular leading-none" style={{ color: valueColor ?? "var(--text-primary)" }}>
        {value}
      </span>
      <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
        {label}
      </span>
    </div>
  );
}
