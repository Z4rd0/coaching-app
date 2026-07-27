import { defineConfig } from "vitest/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Mirror the tsconfig "@/*" -> "./*" path alias so tests import like the app.
  resolve: { alias: { "@": root } },
  // Node env: lib/firebase.ts only warms up Firestore when `window` exists, so
  // importing the data layer in tests stays side-effect free.
  //
  // TZ is pinned to the users' timezone (UTC+1/+2): date placement bugs of the
  // "toISOString() gives the previous day" family are invisible when the suite
  // runs in UTC, which is what CI defaults to.
  test: { environment: "node", include: ["lib/**/*.test.ts"], env: { TZ: "Europe/Rome" } },
});
