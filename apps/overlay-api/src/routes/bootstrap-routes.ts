import { Router } from "express";
import type { BootstrapController } from "../controllers/bootstrap-controller.js";

export function createBootstrapRouter(controller: BootstrapController): Router {
  const router = Router();

  router.get("/status", (req, res) => controller.getStatus(req, res));

  return router;
}
