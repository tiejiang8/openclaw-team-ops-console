import { createResponseMeta } from "@openclaw-team-ops/shared";
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";

import type { SidecarInventoryAdapter } from "./adapters/source-adapter.js";
import { createSidecarRouter } from "./routes/sidecar-routes.js";
import { createBootstrapRouter } from "./routes/bootstrap-routes.js";
import { SidecarService } from "./services/sidecar-service.js";
import { BootstrapStatusService } from "./services/bootstrap-status.js";

export function createSidecarApp(adapter: SidecarInventoryAdapter): Express {
  const app = express();
  const service = new SidecarService(adapter);
  const bootstrapService = new BootstrapStatusService(adapter);

  app.use(cors());
  app.use(express.json({ limit: "250kb" }));
  app.use(createSidecarRouter(service, adapter));
  app.use("/bootstrap", createBootstrapRouter(bootstrapService));

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown sidecar error";

    response.status(502).json({
      error: {
        code: "ADAPTER_UNAVAILABLE",
        message,
      },
      meta: createResponseMeta(new Date().toISOString(), "mixed"),
    });
  });

  return app;
}
