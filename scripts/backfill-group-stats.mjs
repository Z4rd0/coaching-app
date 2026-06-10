/**
 * One-off backfill: compute per-member aggregate stats on every group doc
 * from the existing feed entries (the leaderboard now reads `stats` instead
 * of re-counting the feed on every page view).
 *
 * Run: node scripts/backfill-group-stats.mjs ../coaching-mcp/service-account.json
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const saPath = process.argv[2] ?? "../coaching-mcp/service-account.json";
const sa = JSON.parse(readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const coaches = await db.collection("coaches").get();
let groupsTouched = 0;

for (const coach of coaches.docs) {
  const groups = await coach.ref.collection("groups").get();
  for (const group of groups.docs) {
    const feed = await group.ref.collection("feed").get();
    if (feed.empty) continue;

    const stats = {};
    for (const doc of feed.docs) {
      const e = doc.data();
      if (!e.athleteUid) continue;
      const row = stats[e.athleteUid] ?? {
        name: e.athleteName ?? "Atleta",
        sessions: 0,
        minutes: 0,
      };
      row.sessions += 1;
      row.minutes += typeof e.actualDurationMin === "number" ? e.actualDurationMin : 0;
      stats[e.athleteUid] = row;
    }

    await group.ref.update({ stats });
    groupsTouched++;
    console.log(
      `coach ${coach.id} / group ${group.id}: ${feed.size} entries → ${Object.keys(stats).length} members`
    );
  }
}

console.log(`Done. Updated ${groupsTouched} group(s).`);
process.exit(0);
