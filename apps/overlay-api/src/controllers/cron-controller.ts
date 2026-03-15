import { createResponseMeta, type ErrorResponse } from "@openclaw-team-ops/shared";
import type { NextFunction, Request, Response } from "express";

import type { OverlayService } from "../services/overlay-service.js";
import { buildApiMeta } from "../services/api-meta.js";

export function getCronJobsController(service: OverlayService) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.json(
        await service.getCronJobs({
          ...(typeof request.query.source === "string" ? { source: request.query.source } : {}),
          ...(typeof request.query.status === "string" ? { status: request.query.status } : {}),
          ...(typeof request.query.q === "string" ? { q: request.query.q } : {}),
        }),
      );
    } catch (error) {
      next(error);
    }
  };
}

export function getCronJobController(service: OverlayService) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const job = await service.getCronJob(request.params.id ?? "");

      if (!job) {
        const body: ErrorResponse = {
          error: {
            code: "CRON_JOB_NOT_FOUND",
            message: `Cron job ${request.params.id} was not found`,
          },
          meta: buildApiMeta(createResponseMeta(new Date().toISOString(), "mixed")),
        };

        response.status(404).json(body);
        return;
      }

      response.json(job);
    } catch (error) {
      next(error);
    }
  };
}
