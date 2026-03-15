import { createResponseMeta, type ErrorResponse, type HealthResponse } from "@openclaw-team-ops/shared";
import express, { type Router } from "express";

import { SidecarClient } from "../clients/sidecar-client.js";
import { createLogsRouter } from "../routes/logs.js";
import { buildApiMeta } from "../services/api-meta.js";
import { LogsService } from "../services/logs-service.js";
import { OverlayService } from "../services/overlay-service.js";

export function createApiRouter(service: OverlayService, sidecarClient: SidecarClient): Router {
  const router = express.Router();
  const logsService = new LogsService(sidecarClient);

  router.use((_request, response, next) => {
    response.setHeader("x-openclaw-ops-readonly", "true");
    next();
  });

  router.use(createLogsRouter(logsService));

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

  router.get("/api/targets", async (_request, response, next) => {
    try {
      response.json(await service.getTargets());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/targets/:id", async (request, response, next) => {
    try {
      const targetId = request.params.id ?? "";
      const target = await service.getTargetById(targetId);

      if (!target) {
        const body: ErrorResponse = {
          error: {
            code: "TARGET_NOT_FOUND",
            message: `Target ${targetId} was not found`,
          },
          meta: buildApiMeta(createResponseMeta(new Date().toISOString(), "mixed")),
        };

        response.status(404).json(body);
        return;
      }

      response.json(target);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/targets/:id/summary", async (request, response, next) => {
    try {
      const targetId = request.params.id ?? "";
      const targetSummary = await service.getTargetSummary(targetId);

      if (!targetSummary) {
        const body: ErrorResponse = {
          error: {
            code: "TARGET_NOT_FOUND",
            message: `Target ${targetId} was not found`,
          },
          meta: createResponseMeta(new Date().toISOString(), "mixed"),
        };

        response.status(404).json(body);
        return;
      }

      response.json(targetSummary);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/evidence", async (request, response, next) => {
    try {
      response.json(await service.getEvidences({
        ...(typeof request.query.targetId === "string" ? { targetId: request.query.targetId } : {}),
        ...(typeof request.query.severity === "string" ? { severity: request.query.severity } : {}),
        ...(typeof request.query.kind === "string" ? { kind: request.query.kind } : {}),
        ...(typeof request.query.subjectType === "string" ? { subjectType: request.query.subjectType } : {}),
        ...(typeof request.query.subjectId === "string" ? { subjectId: request.query.subjectId } : {}),
      }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/coverage", async (_request, response, next) => {
    try {
      response.json(await service.getCoverage());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/evidence/:id", async (request, response, next) => {
    try {
      const evidenceId = request.params.id ?? "";
      const evidence = await service.getEvidenceById(evidenceId);

      if (!evidence) {
        const body: ErrorResponse = {
          error: {
            code: "EVIDENCE_NOT_FOUND",
            message: `Evidence ${evidenceId} was not found`,
          },
          meta: buildApiMeta(createResponseMeta(new Date().toISOString(), "mixed")),
        };

        response.status(404).json(body);
        return;
      }

      response.json(evidence);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/findings", async (request, response, next) => {
    try {
      response.json(await service.getFindings({
        ...(typeof request.query.targetId === "string" ? { targetId: request.query.targetId } : {}),
        ...(typeof request.query.severity === "string" ? { severity: request.query.severity } : {}),
        ...(typeof request.query.type === "string" ? { type: request.query.type } : {}),
        ...(typeof request.query.status === "string" ? { status: request.query.status } : {}),
      }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/findings/:id", async (request, response, next) => {
    try {
      const findingId = request.params.id ?? "";
      const finding = await service.getFindingById(findingId);

      if (!finding) {
        const body: ErrorResponse = {
          error: {
            code: "FINDING_NOT_FOUND",
            message: `Finding ${findingId} was not found`,
          },
          meta: buildApiMeta(createResponseMeta(new Date().toISOString(), "mixed")),
        };

        response.status(404).json(body);
        return;
      }

      response.json(finding);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/recommendations", async (request, response, next) => {
    try {
      response.json(await service.getRecommendations({
        ...(typeof request.query.findingId === "string" ? { findingId: request.query.findingId } : {}),
      }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/recommendations/:id", async (request, response, next) => {
    try {
      const recommendationId = request.params.id ?? "";
      const recommendation = await service.getRecommendationById(recommendationId);

      if (!recommendation) {
        const body: ErrorResponse = {
          error: {
            code: "RECOMMENDATION_NOT_FOUND",
            message: `Recommendation ${recommendationId} was not found`,
          },
          meta: buildApiMeta(createResponseMeta(new Date().toISOString(), "mixed")),
        };

        response.status(404).json(body);
        return;
      }

      response.json(recommendation);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/risks/summary", async (_request, response, next) => {
    try {
      response.json(await service.getRisksSummary());
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
          meta: buildApiMeta(createResponseMeta(new Date().toISOString(), "mixed")),
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

  router.get("/api/presence", async (_request, response, next) => {
    try {
      response.json(await service.getPresence());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nodes", async (_request, response, next) => {
    try {
      response.json(await service.getNodes());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/tools", async (_request, response, next) => {
    try {
      response.json(await service.getTools());
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/plugins", async (_request, response, next) => {
    try {
      response.json(await service.getPlugins());
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
