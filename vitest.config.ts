import { defineConfig } from "vitest/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Mirror the tsconfig "@/*" -> "./*" path alias so tests import like the app.
  resolve: { alias: { "@": root } },
  // Node env: lib/firebase.ts only warms up Firestore when `window` exists, so
  // importing the data layer in tests stays side-effect free.
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
