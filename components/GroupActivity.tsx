"use client";

import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Group, GroupFeedEntry } from "@/types";
import { SESSION_TYPE_LABELS } from "@/types";

const TYPE_COLOR: Record<string, string> = {
  strength: "bg-blue-500",
  cardio: "bg-orange-400",
  mobility: "bg-purple-400",
  rest: "bg-slate-500",
  other: "bg-slate-400",
  circuit: "bg-yellow-400",
};

const MEDALS = ["🥇", "🥈", "🥉"];

/** How many feed entries to render in the "recent activity" list */
const FEED_DISPLAY_LIMIT = 30;

interface RankRow {
  athleteUid: string;
  name: string;
  sessions: number;
  minutes: number;
}

/** All-time ranking — never resets. Reads the aggregate counters kept on the
 *  group doc (1 read); falls back to counting the fetched entries for groups
 *  created before the counters existed. */
function buildLeaderboard(
  stats: Group["stats"],
  entries: GroupFeedEntry[]
): RankRow[] {
  let rows: RankRow[];
  if (stats && Object.keys(stats).length > 0) {
    rows = Object.entries(stats).map(([uid, s]) => ({
      athleteUid: uid,
      name: s.name,
      sessions: s.sessions ?? 0,
      minutes: s.minutes ?? 0,
    }));
  } else {
    const byUid = new Map<string, RankRow>();
    for (const e of entries) {
      const row = byUid.get(e.athleteUid) ?? {
        athleteUid: e.athleteUid,
        name: e.athleteName,
        sessions: 0,
        minutes: 0,
      };
      row.sessions += 1;
      row.minutes += e.actualDurationMin;
      byUid.set(e.athleteUid, row);
    }
    rows = Array.from(byUid.values());
  }
  return rows.sort((a, b) => b.sessions - a.sessions || b.minutes - a.minutes);
}

interface Props {
  entries: GroupFeedEntry[];
  /** Aggregate counters from the group doc — preferred leaderboard source */
  stats?: Group["stats"];
  /** Auth UID of the viewer — their row is highlighted as "Tu" */
  highlightUid?: string;
}

export default function GroupActivity({ entries, stats, highlightUid }: Props) {
  const leaderboard = buildLeaderboard(stats, entries);

  return (
    <div className="space-y-6">
      {/* Weekly leaderboard */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          🏆 Classifica
        </p>
        {leaderboard.length === 0 ? (
          <div className="bg-slate-800 rounded-2xl px-4 py-5 border border-slate-700 text-center">
            <p className="text-slate-400 text-sm">Ancora nessun allenamento nel gruppo.</p>
            <p className="text-slate-500 text-xs mt-1">Chi logga per primo va in testa! 💪</p>
          </div>
        ) : (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 divide-y divide-slate-700/50 overflow-hidden">
            {leaderboard.map((row, i) => {
              const isMe = row.athleteUid === highlightUid;
              return (
                <div
                  key={row.athleteUid}
                  className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-primary/10" : ""}`}
                >
                  <span className="w-7 text-center text-base shrink-0">
                    {MEDALS[i] ?? <span className="text-slate-500 text-sm font-semibold">{i + 1}</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isMe ? "text-primary" : "text-white"}`}>
                      {row.name}
                      {isMe && <span className="text-xs font-normal text-primary/70 ml-1.5">(Tu)</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white text-sm font-bold">
                      {row.sessions} {row.sessions === 1 ? "sessione" : "sessioni"}
                    </p>
                    <p className="text-slate-500 text-xs">{row.minutes} min</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent activity feed */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Attività recente
        </p>
        {entries.length === 0 ? (
          <div className="bg-slate-800 rounded-2xl px-4 py-5 border border-slate-700 text-center">
            <p className="text-slate-400 text-sm">Ancora nessuna attività nel gruppo.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, FEED_DISPLAY_LIMIT).map((e) => {
              const isMe = e.athleteUid === highlightUid;
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-3 bg-slate-800 rounded-2xl px-4 py-3 border border-slate-700"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-sm">
                      {e.athleteName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {isMe ? "Tu" : e.athleteName}
                      <span className="text-slate-400 font-normal"> · {e.sessionTitle || (e.sessionType ? SESSION_TYPE_LABELS[e.sessionType] : "Allenamento")}</span>
                    </p>
                    <p className="text-slate-500 text-xs">
                      {format(e.date.toDate(), "EEE d MMM", { locale: it })} · {e.actualDurationMin} min · RPE {e.perceivedRPE}
                    </p>
                  </div>
                  {e.sessionType && (
                    <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_COLOR[e.sessionType] ?? "bg-slate-500"}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
