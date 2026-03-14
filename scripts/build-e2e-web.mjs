import { spawnSync } from "node:child_process";

const result = spawnSync(
  "corepack",
  ["pnpm", "--filter", "@openclaw-team-ops/overlay-web", "build"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_OVERLAY_API_URL: "",
    },
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
