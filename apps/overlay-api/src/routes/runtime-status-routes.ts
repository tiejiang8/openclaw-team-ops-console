import express, { type Router } from "express";

import { getRuntimeStatusController } from "../controllers/runtime-status-controller.js";
import type { OverlayService } from "../services/overlay-service.js";

export function createRuntimeStatusRouter(service: OverlayService): Router {
  const router = express.Router();

  router.get("/api/runtime-status", getRuntimeStatusController(service));

  return router;
}
