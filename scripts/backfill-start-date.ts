/**
 * Backfill: give every ACTIVE program a `startDate`.
 *
 * Programs without a startDate used to fall back to a recurring day-of-week
 * placement, which has no notion of "which week of the program are we in" — the
 * same session was then rendered once by the calendar (deduped by title) and N
 * times by the dashboard. The product decision is that a program is always
 * anchored to a calendar, so the authoring forms now require a start date and
 * the day-of-week fallback is on its way out. This closes the gap for documents
 * written before that.
 *
 * Scope: only `isActive === true` programs (library + athlete + group) — the
 * ones users actually see. Templates and archived programs keep no startDate;
 * they get one when the coach next assigns or edits them.
 *
 * Anchor: Monday of the CURRENT week, i.e. the program restarts from week 1
 * now. Anchoring to createdAt would place old programs entirely in the past and
 * make their sessions vanish from the calendar.
 *
 * Idempotent: a program that already has a startDate is skipped.
 *
 * Run: npx tsx scripts/backfill-start-date.ts [--dry-run] [serviceAccount.json]
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const saPath = args.find((a) => !a.startsWith("--")) ?? "../coaching-mcp/service-account.json";

const sa = JSON.parse(readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

/** Monday of the week containing `d`, as a local ISO day-string. */
function mondayOfWeek(d: Date): string {
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  // getDay(): Sun=0 … Sat=6 → days to subtract to reach Monday.
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return [
    monday.getFullYear(),
    String(monday.getMonth() + 1).padStart(2, "0"),
    String(monday.getDate()).padStart(2, "0"),
  ].join("-");
}

const ANCHOR = mondayOfWeek(new Date());

let updated = 0;
let skipped = 0;
let inactive = 0;

async function backfillCollection(ref: FirebaseFirestore.CollectionReference, label: string) {
  const snap = await ref.get();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.isActive !== true) {
      inactive++;
      continue;
    }
    if (typeof data.startDate === "string" && data.startDate.length > 0) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] ${label}/${doc.id} "${data.name ?? "—"}" → startDate=${ANCHOR}`);
    } else {
      await doc.ref.update({ startDate: ANCHOR });
      console.log(`✔ ${label}/${doc.id} "${data.name ?? "—"}" → startDate=${ANCHOR}`);
    }
    updated++;
  }
}

// Wrapped in an async IIFE: tsx transpiles this .ts to CJS, which doesn't allow
// top-level await.
async function main() {
  console.log(`Anchor (Monday of the current week): ${ANCHOR}\n`);

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
    `\n${dryRun ? "[dry-run] " : ""}Done. ${updated} active program(s) ${dryRun ? "would get " : "got "}a startDate, ` +
    `${skipped} already had one, ${inactive} inactive/template skipped.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
