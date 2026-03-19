import { Router } from "express";
import { StreamingController } from "../controllers/streaming-controller.js";

export function createStreamingRouter(controller: StreamingController): Router {
  const router = Router();
  router.get("/", controller.handleStream);
  return router;
}
