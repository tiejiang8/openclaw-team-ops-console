import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";

import { SidecarClient } from "./clients/sidecar-client.js";
import { createApiRouter } from "./routes/api-routes.js";
import { OverlayService } from "./services/overlay-service.js";

export function createOverlayApiApp(sidecarClient: SidecarClient): Express {
  const app = express();
  const service = new OverlayService(sidecarClient);

  app.use(cors());
  app.use(express.json({ limit: "250kb" }));
  app.use(createApiRouter(service, sidecarClient));

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown API error";

    response.status(502).json({
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        message,
      },
      meta: {
        generatedAt: new Date().toISOString(),
        source: "mixed",
        readOnly: true,
      },
    });
  });

  return app;
}
