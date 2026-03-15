import { createResponseMeta, type ErrorResponse } from "@openclaw-team-ops/shared";
import express, { type Router } from "express";

import { buildApiMeta } from "../services/api-meta.js";
import { LogsService } from "../services/logs-service.js";

export function createLogsRouter(service: LogsService): Router {
  const router = express.Router();

  router.get("/api/logs/files", async (_request, response, next) => {
    try {
      response.json(await service.getLogFiles());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/logs/summary", async (request, response, next) => {
    try {
      response.json(await service.getLogSummary(typeof request.query.date === "string" ? request.query.date : undefined));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/logs/entries", async (request, response, next) => {
    try {
      const limit =
        typeof request.query.limit === "string" && request.query.limit.trim().length > 0
          ? Number.parseInt(request.query.limit, 10)
          : undefined;

      response.json(
        await service.getLogEntries({
          ...(typeof request.query.date === "string" ? { date: request.query.date } : {}),
          ...(typeof request.query.cursor === "string" ? { cursor: request.query.cursor } : {}),
          ...(typeof limit === "number" && !Number.isNaN(limit) ? { limit } : {}),
          ...(typeof request.query.q === "string" ? { q: request.query.q } : {}),
          ...(typeof request.query.level === "string" ? { level: request.query.level } : {}),
          ...(typeof request.query.subsystem === "string" ? { subsystem: request.query.subsystem } : {}),
          ...(typeof request.query.tag === "string" ? { tag: request.query.tag } : {}),
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/logs/files/:date/raw", async (request, response, next) => {
    try {
      const date = request.params.date ?? "";
      const logFile = await service.getLogRawFile(date);

      if (!logFile) {
        const body: ErrorResponse = {
          error: {
            code: "LOG_FILE_NOT_FOUND",
            message: `Log file for ${date} was not found`,
          },
          meta: buildApiMeta(createResponseMeta(new Date().toISOString(), "mixed")),
        };

        response.status(404).json(body);
        return;
      }

      response.json(logFile);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
