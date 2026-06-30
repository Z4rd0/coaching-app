/**
 * One-off migration: move Strava OAuth tokens out of the coach-readable
 * `athleteAccess/{uid}.strava` field into the server-only collection
 * `athleteStravaTokens/{uid}`, then delete the legacy field (AUDIT ALTO-1).
 *
 * Idempotent: re-running skips docs that have no legacy `strava` field.
 * `getStravaTokens()` also migrates lazily on read, so this script is only to
 * scrub the coach-readable copies eagerly instead of waiting for first use.
 *
 * Run: node scripts/migrate-strava-tokens.mjs ../coaching-mcp/service-account.json
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const saPath = process.argv[2] ?? "../coaching-mcp/service-account.json";
const sa = JSON.parse(readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const accessDocs = await db.collection("athleteAccess").get();
let migrated = 0;
let skipped = 0;

for (const docSnap of accessDocs.docs) {
  const strava = docSnap.data()?.strava;
  if (!strava) {
    skipped++;
    continue;
  }
  const uid = docSnap.id;
  await db.collection("athleteStravaTokens").doc(uid).set(strava, { merge: true });
  await docSnap.ref.update({ strava: FieldValue.delete() });
  migrated++;
  console.log(`✔ migrated tokens for ${uid}`);
}

console.log(`\nDone. Migrated ${migrated}, skipped ${skipped} (no Strava tokens).`);
process.exit(0);
