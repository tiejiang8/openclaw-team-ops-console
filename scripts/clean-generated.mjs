import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const directoriesToRemove = [
  "apps/overlay-api/dist",
  "apps/overlay-web/dist",
  "apps/overlay-web/.vite",
  "apps/sidecar/dist",
  "packages/shared/dist",
];

for (const relativePath of directoriesToRemove) {
  const absolutePath = join(root, relativePath);

  if (!existsSync(absolutePath)) {
    continue;
  }

  rmSync(absolutePath, { force: true, recursive: true });
  console.log(`[clean] removed ${relativePath}`);
}

console.log("[clean] generated artifacts reset complete");
