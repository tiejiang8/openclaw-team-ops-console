import cors from "cors";
import express, { type Express } from "express";

import type { SidecarInventoryAdapter } from "./adapters/source-adapter.js";
import { createSidecarRouter } from "./routes/sidecar-routes.js";
import { SidecarService } from "./services/sidecar-service.js";

export function createSidecarApp(adapter: SidecarInventoryAdapter): Express {
  const app = express();
  const service = new SidecarService(adapter);

  app.use(cors());
  app.use(express.json({ limit: "250kb" }));
  app.use(createSidecarRouter(service, adapter));

  return app;
}
