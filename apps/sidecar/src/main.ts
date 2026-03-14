import { createSidecarAdapterFromEnv } from "./adapters/create-adapter.js";
import { createSidecarApp } from "./app.js";

const port = Number(process.env.SIDECAR_PORT ?? 4310);
const host = process.env.SIDECAR_HOST ?? "127.0.0.1";
const adapter = createSidecarAdapterFromEnv(process.env);
const app = createSidecarApp(adapter);

app.listen(port, host, () => {
  console.log(`[sidecar] listening on http://${host}:${port}`);
  if (process.env.SIDECAR_TARGETS_FILE) {
    console.log(`[sidecar] targetsFile=${process.env.SIDECAR_TARGETS_FILE}`);
  } else if (process.env.SIDECAR_TARGET_ID || process.env.SIDECAR_TARGET_NAME) {
    console.log(
      `[sidecar] targetId=${process.env.SIDECAR_TARGET_ID ?? "(derived)"} targetName=${process.env.SIDECAR_TARGET_NAME ?? "(derived)"}`,
    );
  }

  if (adapter.mode === "mock") {
    console.log(
      `[sidecar] mode=read-only source=mock scenario=${process.env.SIDECAR_MOCK_SCENARIO ?? "baseline"}`,
    );
    return;
  }

  console.log("[sidecar] mode=read-only source=openclaw adapter=filesystem");
  console.log(
    `[sidecar] runtimeRoot=${process.env.OPENCLAW_RUNTIME_ROOT ?? process.env.OPENCLAW_STATE_DIR ?? "(derived or unset)"} configFile=${process.env.OPENCLAW_CONFIG_FILE ?? process.env.OPENCLAW_CONFIG_PATH ?? "(derived or unset)"} workspaceGlob=${process.env.OPENCLAW_WORKSPACE_GLOB ?? "(derived official default)"} profile=${process.env.OPENCLAW_PROFILE ?? "(default)"}`,
  );
});
