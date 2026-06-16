/**
 * Read-only audit: list every coach doc with email, athlete count and any
 * billing-related fields. Cross-references Firebase Auth for the real email.
 *
 * Run: node scripts/list-coaches.mjs ../coaching-mcp/service-account.json
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const saPath = process.argv[2] ?? "../coaching-mcp/service-account.json";
const sa = JSON.parse(readFileSync(saPath, "utf-8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const auth = getAuth();

const coaches = await db.collection("coaches").get();
console.log(`\nFound ${coaches.size} coach doc(s):\n`);

for (const coach of coaches.docs) {
  const d = coach.data();
  let authEmail = "?";
  try {
    const u = await auth.getUser(coach.id);
    authEmail = u.email ?? "(no email)";
  } catch {
    authEmail = "(no auth user)";
  }
  const athletes = await coach.ref.collection("athletes").get();
  const programs = await coach.ref.collection("programs").get();
  const groups = await coach.ref.collection("groups").get();
  console.log(`uid: ${coach.id}`);
  console.log(`  doc.email : ${d.email ?? "(none)"}`);
  console.log(`  auth.email: ${authEmail}`);
  console.log(`  name      : ${d.name ?? "(none)"}`);
  console.log(`  plan      : ${d.plan ?? "(unset)"}`);
  console.log(`  athletes  : ${athletes.size}  | programs: ${programs.size} | groups: ${groups.size}`);
  console.log("");
}

process.exit(0);
