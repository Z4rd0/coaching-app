/**
 * Backfill: give every session in every EXISTING program a stable `id`.
 *
 * Sessions used to be addressed positionally (`?ci=&wi=&si=`) or by date, both
 * of which point at the wrong workout as soon as the coach reorders or
 * reschedules anything. `serializeSessionForWrite` now assigns an id on every
 * write, so new and edited programs get one for free; this closes the gap for
 * documents nobody has touched since.
 *
 * Reuses the app's real serializer, so the ids it writes are produced exactly
 * like the app's — and existing ids are never regenerated.
 *
 * Idempotent: a program whose every session already has an id is skipped.
 * Read-only in --dry-run.
 *
 * Run: npx tsx scripts/backfill-session-ids.ts [--dry-run] [serviceAccount.json]
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
let sessionsTouched = 0;

/** True when at least one session in the program has no id. */
function needsBackfill(data: FirebaseFirestore.DocumentData): boolean {
  for (const cycle of data.cycles ?? []) {
    for (const week of cycle.weeks ?? []) {
      for (const session of week.sessions ?? []) {
        if (typeof session.id !== "string" || session.id.length === 0) return true;
      }
    }
  }
  return false;
}

function countMissing(data: FirebaseFirestore.DocumentData): number {
  let n = 0;
  for (const cycle of data.cycles ?? [])
    for (const week of cycle.weeks ?? [])
      for (const session of week.sessions ?? [])
        if (typeof session.id !== "string" || session.id.length === 0) n++;
  return n;
}

async function backfillCollection(ref: FirebaseFirestore.CollectionReference, label: string) {
  const snap = await ref.get();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!Array.isArray(data.cycles) || !needsBackfill(data)) {
      skipped++;
      continue;
    }
    const missing = countMissing(data);
    const { cycles } = serializeProgramForWrite({ cycles: data.cycles });
    if (dryRun) {
      console.log(`[dry-run] ${label}/${doc.id} "${data.name ?? "—"}" → ${missing} session id(s)`);
    } else {
      await doc.ref.update({ cycles });
      console.log(`✔ ${label}/${doc.id} "${data.name ?? "—"}" → ${missing} session id(s)`);
    }
    updated++;
    sessionsTouched += missing;
  }
}

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

  console.log(
    `\n${dryRun ? "[dry-run] " : ""}Done. ${updated} program(s) ${dryRun ? "would be " : ""}updated, ` +
    `${sessionsTouched} session(s) ${dryRun ? "would get " : "got "}an id, ${skipped} skipped.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
