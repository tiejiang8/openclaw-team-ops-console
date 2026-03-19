import { Router } from "express";
import { createResponseMeta } from "@openclaw-team-ops/shared";
import type { BootstrapStatusService } from "../services/bootstrap-status.js";

export function createBootstrapRouter(service: BootstrapStatusService) {
  const router = Router();

  router.get("/status", async (_req, res) => {
    try {
      const status = await service.getStatus();
      res.json({
        data: status,
        meta: createResponseMeta(new Date().toISOString(), "openclaw"),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown bootstrap error";
      res.status(500).json({
        error: {
          code: "BOOTSTRAP_ERROR",
          message,
        },
        meta: createResponseMeta(new Date().toISOString(), "openclaw"),
      });
    }
  });

  return router;
}
