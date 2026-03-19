import { Router } from "express";
import { FleetMapController } from "../controllers/fleet-map-controller.js";

export function createFleetMapRouter(controller: FleetMapController): Router {
  const router = Router();

  router.get("/", (req, res) => controller.getFleetMap(req, res));

  return router;
}
