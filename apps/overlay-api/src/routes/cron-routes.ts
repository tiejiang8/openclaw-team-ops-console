import express, { type Router } from "express";

import { getCronJobController, getCronJobsController } from "../controllers/cron-controller.js";
import type { OverlayService } from "../services/overlay-service.js";

export function createCronRouter(service: OverlayService): Router {
  const router = express.Router();

  router.get("/api/cron", getCronJobsController(service));
  router.get("/api/cron/:id", getCronJobController(service));

  return router;
}
