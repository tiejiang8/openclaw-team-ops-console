import { createResponseMeta, type CollectionName, type ErrorResponse } from "@openclaw-team-ops/shared";
import type { NextFunction, Request, Response, Router } from "express";
import express from "express";

import type { SidecarInventoryAdapter } from "../adapters/source-adapter.js";
import type { SidecarService } from "../services/sidecar-service.js";

export function createSidecarRouter(service: SidecarService, adapter: SidecarInventoryAdapter): Router {
  const router = express.Router();
  const selectCollection = (snapshot: Awaited<ReturnType<SidecarService["getSnapshot"]>>, collection: CollectionName) => ({
    [collection]: snapshot.collections[collection],
  });
  const handleAsync =
    (handler: (request: Request, response: Response, next: NextFunction) => Promise<void>) =>
    (request: Request, response: Response, next: NextFunction) => {
      Promise.resolve(handler(request, response, next)).catch(next);
    };

  router.use((_request, response, next) => {
    response.setHeader("x-openclaw-ops-readonly", "true");
    next();
  });

  router.get("/health", handleAsync(async (_request, response) => {
    const adapterHealth = await adapter.healthCheck();
    response.json({
      service: "sidecar",
      status: adapterHealth.status === "ok" ? "ok" : "degraded",
      time: adapterHealth.observedAt,
      checks: [
        {
          name: adapterHealth.name,
          status: adapterHealth.status,
          details: adapterHealth.details,
        },
      ],
    });
  }));

  router.get("/sidecar/snapshot", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
        collections: snapshot.collections,
        warnings: snapshot.warnings,
      }),
    });
  }));

  router.get("/sidecar/summary", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.summary,
      runtimeStatuses: snapshot.runtimeStatuses,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
        collections: snapshot.collections,
        warnings: snapshot.warnings,
      }),
    });
  }));

  router.get("/sidecar/targets", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    const targets = await service.getTargets();
    response.json({
      data: targets,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source, {
          warnings: snapshot.warnings,
        }),
        count: targets.length,
      },
    });
  }));

  router.get("/sidecar/targets/:id", handleAsync(async (request, response) => {
    const snapshot = await service.getSnapshot();
    const targetId = request.params.id ?? "";
    const target = await service.getTargetById(targetId);

    if (!target) {
      const body: ErrorResponse = {
        error: {
          code: "TARGET_NOT_FOUND",
          message: `Target ${targetId} was not found`,
        },
        meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
          warnings: snapshot.warnings,
        }),
      };
      response.status(404).json(body);
      return;
    }

    response.json({
      data: target,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
        warnings: snapshot.warnings,
      }),
    });
  }));

  router.get("/sidecar/targets/:id/summary", handleAsync(async (request, response) => {
    const snapshot = await service.getSnapshot();
    const targetId = request.params.id ?? "";
    const targetSummary = await service.getTargetSummary(targetId);

    if (!targetSummary) {
      const body: ErrorResponse = {
        error: {
          code: "TARGET_NOT_FOUND",
          message: `Target ${targetId} was not found`,
        },
        meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
          warnings: snapshot.warnings,
        }),
      };
      response.status(404).json(body);
      return;
    }

    response.json({
      data: targetSummary,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
        collections: snapshot.collections,
        warnings: snapshot.warnings,
      }),
    });
  }));

  router.get("/sidecar/agents", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.agents,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source, {
          collections: selectCollection(snapshot, "agents"),
          warnings: snapshot.warnings,
        }),
        count: snapshot.agents.length,
      },
    });
  }));

  router.get("/sidecar/agents/:id", handleAsync(async (request, response) => {
    const snapshot = await service.getSnapshot();
    const agent = snapshot.agents.find((candidate) => candidate.id === request.params.id);

    if (!agent) {
      const body: ErrorResponse = {
        error: {
          code: "AGENT_NOT_FOUND",
          message: `Agent ${request.params.id} was not found`,
        },
        meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
          collections: selectCollection(snapshot, "agents"),
          warnings: snapshot.warnings,
        }),
      };
      response.status(404).json(body);
      return;
    }

    response.json({
      data: agent,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
        collections: selectCollection(snapshot, "agents"),
        warnings: snapshot.warnings,
      }),
    });
  }));

  router.get("/sidecar/workspaces", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.workspaces,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source, {
          collections: selectCollection(snapshot, "workspaces"),
          warnings: snapshot.warnings,
        }),
        count: snapshot.workspaces.length,
      },
    });
  }));

  router.get("/sidecar/workspaces/:id/documents/:fileName", handleAsync(async (request, response) => {
    const snapshot = await service.getSnapshot();
    const workspaceId = request.params.id ?? "";
    const fileName = request.params.fileName ?? "";
    const document = await service.getWorkspaceDocument(workspaceId, fileName);

    if (!document) {
      const body: ErrorResponse = {
        error: {
          code: "WORKSPACE_DOCUMENT_NOT_FOUND",
          message: `Workspace document ${fileName} was not found for ${workspaceId}`,
        },
        meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
          collections: selectCollection(snapshot, "workspaces"),
          warnings: snapshot.warnings,
        }),
      };
      response.status(404).json(body);
      return;
    }

    response.json({
      data: document,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
        collections: selectCollection(snapshot, "workspaces"),
        warnings: snapshot.warnings,
      }),
    });
  }));

  router.get("/sidecar/sessions", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.sessions,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source, {
          collections: selectCollection(snapshot, "sessions"),
          warnings: snapshot.warnings,
        }),
        count: snapshot.sessions.length,
      },
    });
  }));

  router.get("/sidecar/bindings", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.bindings,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source, {
          collections: selectCollection(snapshot, "bindings"),
          warnings: snapshot.warnings,
        }),
        count: snapshot.bindings.length,
      },
    });
  }));

  router.get("/sidecar/auth-profiles", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.authProfiles,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source, {
          collections: selectCollection(snapshot, "authProfiles"),
          warnings: snapshot.warnings,
        }),
        count: snapshot.authProfiles.length,
      },
    });
  }));

  router.get("/sidecar/topology", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.topology,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source, {
        collections: selectCollection(snapshot, "topology"),
        warnings: snapshot.warnings,
      }),
    });
  }));

  return router;
}
