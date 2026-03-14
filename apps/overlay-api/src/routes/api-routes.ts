import { createResponseMeta, type ErrorResponse, type HealthResponse } from "@openclaw-team-ops/shared";
import express, { type Router } from "express";

import { SidecarClient } from "../clients/sidecar-client.js";
import { OverlayService } from "../services/overlay-service.js";

export function createApiRouter(service: OverlayService, sidecarClient: SidecarClient): Router {
  const router = express.Router();

  router.use((_request, response, next) => {
    response.setHeader("x-openclaw-ops-readonly", "true");
    next();
  });

  router.get("/health", async (_request, response) => {
    try {
      const sidecarHealth = await sidecarClient.getHealth();

      const body: HealthResponse = {
        service: "overlay-api",
        status: sidecarHealth.status === "ok" ? "ok" : "degraded",
        time: new Date().toISOString(),
        checks: [
          {
            name: "overlay-api",
            status: "ok",
            details: "Read-only API process is running",
          },
          {
            name: "sidecar",
            status: sidecarHealth.status === "ok" ? "ok" : "degraded",
            details: `adapter checks: ${sidecarHealth.checks.map((check) => `${check.name}:${check.status}`).join(", ")}`,
          },
        ],
      };

      response.json(body);
    } catch {
      const body: HealthResponse = {
        service: "overlay-api",
        status: "degraded",
        time: new Date().toISOString(),
        checks: [
          {
            name: "overlay-api",
            status: "ok",
            details: "Read-only API process is running",
          },
          {
            name: "sidecar",
            status: "down",
            details: "Sidecar dependency unreachable",
          },
        ],
      };

      response.status(503).json(body);
    }
  });

  router.get("/api/summary", async (_request, response, next) => {
    try {
      response.json(await service.getSummary());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/agents", async (_request, response, next) => {
    try {
      response.json(await service.getAgents());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/agents/:id", async (request, response, next) => {
    try {
      const agent = await service.getAgentById(request.params.id);

      if (!agent) {
        const body: ErrorResponse = {
          error: {
            code: "AGENT_NOT_FOUND",
            message: `Agent ${request.params.id} was not found`,
          },
          meta: createResponseMeta(new Date().toISOString(), "mixed"),
        };

        response.status(404).json(body);
        return;
      }

      response.json(agent);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/workspaces", async (_request, response, next) => {
    try {
      response.json(await service.getWorkspaces());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/workspaces/:id/documents/:fileName", async (request, response, next) => {
    try {
      const workspaceId = request.params.id ?? "";
      const fileName = request.params.fileName ?? "";
      const document = await service.getWorkspaceDocument(workspaceId, fileName);

      if (!document) {
        const body: ErrorResponse = {
          error: {
            code: "WORKSPACE_DOCUMENT_NOT_FOUND",
            message: `Workspace document ${fileName} was not found for ${workspaceId}`,
          },
          meta: createResponseMeta(new Date().toISOString(), "mixed"),
        };

        response.status(404).json(body);
        return;
      }

      response.json(document);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/sessions", async (_request, response, next) => {
    try {
      response.json(await service.getSessions());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/bindings", async (_request, response, next) => {
    try {
      response.json(await service.getBindings());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/auth-profiles", async (_request, response, next) => {
    try {
      response.json(await service.getAuthProfiles());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/topology", async (_request, response, next) => {
    try {
      response.json(await service.getTopology());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/runtime-status", async (_request, response, next) => {
    try {
      response.json(await service.getRuntimeStatuses());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
