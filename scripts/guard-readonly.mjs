import { readFileSync } from "node:fs";
import { join } from "node:path";

const filesToCheck = [
  "apps/sidecar/src/routes/sidecar-routes.ts",
  "apps/overlay-api/src/routes/api-routes.ts",
  "apps/overlay-api/src/routes/runtime-status-routes.ts",
  "apps/overlay-api/src/routes/cron-routes.ts",
  "apps/overlay-api/src/routes/node-routes.ts",
];

const forbiddenRoutePattern = /\b(?:router|app)\.(post|put|patch|delete)\s*\(/g;
const violations = [];

for (const relativePath of filesToCheck) {
  const contents = readFileSync(join(process.cwd(), relativePath), "utf8");
  const matches = [...contents.matchAll(forbiddenRoutePattern)];

  for (const match of matches) {
    violations.push(`${relativePath}: found forbidden ${match[1].toUpperCase()} route registration`);
  }
}

if (violations.length > 0) {
  console.error("[guard:readonly] read-only boundary violation detected");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("[guard:readonly] GET-only route guard passed");
