/**
 * Migration: move Strava OAuth tokens out of the coach-readable
 * `athleteAccess/{uid}.strava` field into the server-only collection
 * `athleteStravaTokens/{uid}`, then delete the legacy field (AUDIT ALTO-1).
 *
 * SAFETY / SEQUENCING — read before running on real data:
 *   1. Take a backup FIRST (the rollback path depends on it):
 *        node scripts/migrate-strava-tokens.mjs --backup > athleteAccess.bak.json
 *      or a server-side `gcloud firestore export`.
 *   2. This script must run AFTER the new app code (lib/strava-tokens.ts + the
 *      strava routes) is deployed. The new code reads via getStravaTokens(),
 *      which falls back to the legacy field, so athletes stay connected during
 *      the whole window. Running it BEFORE the code deploy would break Strava
 *      reads for the old code path.
 *
 * Modes:
 *   (default)    forward migrate + scrub legacy copies. Idempotent: re-running
 *                skips docs already migrated (no legacy `strava`).
 *   --dry-run    report what WOULD change, write nothing.
 *   --backup     print every athleteAccess/{uid}.strava as JSON (no writes) —
 *                pipe to a file before migrating.
 *   --rollback   reverse: copy athleteStravaTokens/{uid} back into
 *                athleteAccess/{uid}.strava (restores the pre-migration state).
 *
 * Run: node scripts/migrate-strava-tokens.mjs [--dry-run|--backup|--rollback] [serviceAccount.json]
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const backup = args.includes("--backup");
const rollback = args.includes("--rollback");
const saPath = args.find((a) => !a.startsWith("--")) ?? "../coaching-mcp/service-account.json";

const sa = JSON.parse(readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ACCESS = "athleteAccess";
const TOKENS = "athleteStravaTokens";

if (backup) {
  // Dump legacy tokens so the migration is recoverable from a file.
  const snap = await db.collection(ACCESS).get();
  const out = {};
  for (const d of snap.docs) if (d.data()?.strava) out[d.id] = d.data().strava;
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(0);
}

if (rollback) {
  const snap = await db.collection(TOKENS).get();
  let restored = 0;
  for (const d of snap.docs) {
    if (dryRun) { console.log(`[dry-run] would restore ${d.id} → ${ACCESS}/${d.id}.strava`); restored++; continue; }
    await db.collection(ACCESS).doc(d.id).set({ strava: d.data() }, { merge: true });
    restored++;
    console.log(`↩ restored tokens for ${d.id}`);
  }
  console.log(`\nRollback done. Restored ${restored} doc(s) to ${ACCESS}.strava.`);
  process.exit(0);
}

// Forward migration.
const accessDocs = await db.collection(ACCESS).get();
let migrated = 0;
let skipped = 0;

for (const docSnap of accessDocs.docs) {
  const strava = docSnap.data()?.strava;
  if (!strava) {
    skipped++;
    continue;
  }
  const uid = docSnap.id;
  if (dryRun) {
    console.log(`[dry-run] would migrate ${uid} → ${TOKENS}/${uid} and delete legacy field`);
    migrated++;
    continue;
  }
  // Write the secure copy FIRST, then delete the legacy field. If the process
  // dies in between, the token simply exists in both places — safe, and the
  // next run (or getStravaTokens) finishes the scrub. Idempotent.
  await db.collection(TOKENS).doc(uid).set(strava, { merge: true });
  await docSnap.ref.update({ strava: FieldValue.delete() });
  migrated++;
  console.log(`✔ migrated tokens for ${uid}`);
}

console.log(`\n${dryRun ? "[dry-run] " : ""}Done. Migrated ${migrated}, skipped ${skipped} (no Strava tokens).`);
process.exit(0);
