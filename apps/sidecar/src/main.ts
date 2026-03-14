import { MockOpenClawAdapter } from "./adapters/mock/mock-adapter.js";
import { createSidecarApp } from "./app.js";

const port = Number(process.env.SIDECAR_PORT ?? 4310);
const adapter = new MockOpenClawAdapter();
const app = createSidecarApp(adapter);

app.listen(port, () => {
  console.log(`[sidecar] listening on http://localhost:${port}`);
  console.log("[sidecar] mode=read-only source=mock");
});
