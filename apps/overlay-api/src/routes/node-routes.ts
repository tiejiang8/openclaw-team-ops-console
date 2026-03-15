import express, { type Router } from "express";

import { getNodesController } from "../controllers/node-controller.js";
import type { OverlayService } from "../services/overlay-service.js";

export function createNodeRouter(service: OverlayService): Router {
  const router = express.Router();

  router.get("/api/nodes", getNodesController(service));

  return router;
}
