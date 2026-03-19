import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";

import { SidecarClient } from "./clients/sidecar-client.js";
import { createApiRouter } from "./routes/api-routes.js";
import { OverlayService } from "./services/overlay-service.js";
import { BootstrapService } from "./services/bootstrap-service.js";
import { BootstrapController } from "./controllers/bootstrap-controller.js";
import { createBootstrapRouter } from "./routes/bootstrap-routes.js";
import { FleetMapService } from "./services/fleet-map-service.js";
import { FleetMapController } from "./controllers/fleet-map-controller.js";
import { createFleetMapRouter } from "./routes/fleet-map-routes.js";
import { ActivityService } from "./services/activity-service.js";
import { ActivityController } from "./controllers/activity-controller.js";
import { createActivityRouter } from "./routes/activity-routes.js";
import { StreamingService } from "./services/streaming-service.js";
import { StreamingController } from "./controllers/streaming-controller.js";
import { createStreamingRouter } from "./routes/streaming-routes.js";

export function createOverlayApiApp(sidecarClient: SidecarClient): Express {
  const app = express();
  const overlayService = new OverlayService(sidecarClient); // Renamed 'service' to 'overlayService' for clarity with the diff
  const bootstrapService = new BootstrapService(sidecarClient);
  const bootstrapController = new BootstrapController(bootstrapService);

  const fleetMapService = new FleetMapService(sidecarClient);
  const fleetMapController = new FleetMapController(fleetMapService);

  const activityService = new ActivityService(sidecarClient);
  const activityController = new ActivityController(activityService);

  const streamingService = new StreamingService(sidecarClient, activityService);
  const streamingController = new StreamingController(streamingService);

  app.use(cors());
  app.use(express.json({ limit: "250kb" }));
  
  // Existing API routes
  app.use("/api", createApiRouter(overlayService, sidecarClient));
  
  // New bootstrap and fleet map routes
  app.use("/api/bootstrap", createBootstrapRouter(bootstrapController));
  app.use("/api/fleet-map", createFleetMapRouter(fleetMapController));
  app.use("/api/activity", createActivityRouter(activityController));
  app.use("/api/stream", createStreamingRouter(streamingController));

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
