/**
 * Backfill: materialize the composable `segments` on every EXISTING program
 * document (library + athlete + group), reusing the app's real
 * serializeProgramForWrite so the projection can never drift (AUDIT §6 /
 * MIGRATION_SEGMENTS.md step 4). New writes already dual-write; this closes the
 * gap for documents created before the migration.
 *
 * Idempotent: a program whose every session already has `segments` is skipped.
 * Read-only in --dry-run. Logs are NOT backfilled here (they need normalizeLog,
 * a later step); read-time synthesis covers them meanwhile.
 *
 * Run: npx tsx scripts/backfill-segments.ts [--dry-run] [serviceAccount.json]
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { serializeProgramForWrite } from "../lib/segments";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const saPath = args.find((a) => !a.startsWith("--")) ?? "../coaching-mcp/service-account.json";

const sa = JSON.parse(readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

let updated = 0;
let skipped = 0;

/** True when at least one session in the program lacks a segments array. */
function needsBackfill(data: FirebaseFirestore.DocumentData): boolean {
  for (const cycle of data.cycles ?? []) {
    for (const week of cycle.weeks ?? []) {
      for (const session of week.sessions ?? []) {
        if (!Array.isArray(session.segments) || session.segments.length === 0) return true;
      }
    }
  }
  return false;
}

async function backfillCollection(ref: FirebaseFirestore.CollectionReference, label: string) {
  const snap = await ref.get();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!Array.isArray(data.cycles) || !needsBackfill(data)) {
      skipped++;
      continue;
    }
    const { cycles } = serializeProgramForWrite({ cycles: data.cycles });
    if (dryRun) {
      console.log(`[dry-run] would backfill ${label}/${doc.id}`);
    } else {
      await doc.ref.update({ cycles });
      console.log(`✔ backfilled ${label}/${doc.id}`);
    }
    updated++;
  }
}

// Wrapped in an async IIFE: tsx transpiles this .ts to CJS, which doesn't allow
// top-level await.
async function main() {
  const coaches = await db.collection("coaches").get();
  for (const coach of coaches.docs) {
    const c = coach.ref;
    await backfillCollection(c.collection("programs"), `coaches/${coach.id}/programs`);

    const athletes = await c.collection("athletes").get();
    for (const a of athletes.docs) {
      await backfillCollection(a.ref.collection("programs"), `athletes/${a.id}/programs`);
    }

    const groups = await c.collection("groups").get();
    for (const g of groups.docs) {
      await backfillCollection(g.ref.collection("programs"), `groups/${g.id}/programs`);
    }
  }

  console.log(`\n${dryRun ? "[dry-run] " : ""}Done. ${updated} program(s) ${dryRun ? "would be " : ""}backfilled, ${skipped} skipped.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
