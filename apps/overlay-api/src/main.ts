import { createOverlayApiApp } from "./app.js";
import { SidecarClient } from "./clients/sidecar-client.js";

const port = Number(process.env.OVERLAY_API_PORT ?? 4300);
const host = process.env.OVERLAY_API_HOST ?? "127.0.0.1";
const sidecarBaseUrl = process.env.SIDECAR_BASE_URL ?? "http://127.0.0.1:4310";

const app = createOverlayApiApp(
  new SidecarClient({
    baseUrl: sidecarBaseUrl,
    timeoutMs: Number(process.env.SIDECAR_TIMEOUT_MS ?? 5000),
  }),
);

app.listen(port, host, () => {
  console.log(`[overlay-api] listening on http://${host}:${port}`);
  console.log(`[overlay-api] sidecar=${sidecarBaseUrl}`);
  console.log("[overlay-api] mode=read-only");
});
