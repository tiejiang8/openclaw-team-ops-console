import { Router } from "express";
import { ActivityController } from "../controllers/activity-controller.js";

export function createActivityRouter(activityController: ActivityController): Router {
  const router = Router();

  router.get("/", (req, res) => activityController.getActivity(req, res));

  return router;
}
