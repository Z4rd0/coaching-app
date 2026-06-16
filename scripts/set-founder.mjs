/**
 * One-off: mark a coach account as founder — exempt from all plan limits and
 * billing (free & unlimited forever). The Stripe webhook must never overwrite
 * `exempt: true` accounts.
 *
 * Run: node scripts/set-founder.mjs <coachUid> ../coaching-mcp/service-account.json
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const uid = process.argv[2];
const saPath = process.argv[3] ?? "../coaching-mcp/service-account.json";
if (!uid) {
  console.error("Usage: node scripts/set-founder.mjs <coachUid> [service-account.json]");
  process.exit(1);
}

const sa = JSON.parse(readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ref = db.collection("coaches").doc(uid);
const snap = await ref.get();
if (!snap.exists) {
  console.error(`Coach ${uid} not found.`);
  process.exit(1);
}

await ref.set(
  { plan: "founder", exempt: true, status: "active" },
  { merge: true }
);
console.log(`Coach ${uid} (${snap.data().email}) → plan: founder, exempt: true, status: active`);
process.exit(0);
