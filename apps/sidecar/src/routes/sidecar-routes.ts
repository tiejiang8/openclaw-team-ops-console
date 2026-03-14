import { createResponseMeta, type ErrorResponse } from "@openclaw-team-ops/shared";
import type { Router } from "express";
import express from "express";

import type { SidecarInventoryAdapter } from "../adapters/source-adapter.js";
import type { SidecarService } from "../services/sidecar-service.js";

export function createSidecarRouter(service: SidecarService, adapter: SidecarInventoryAdapter): Router {
  const router = express.Router();

  router.use((_request, response, next) => {
    response.setHeader("x-openclaw-ops-readonly", "true");
    next();
  });

  router.get("/health", async (_request, response) => {
    const adapterHealth = await adapter.healthCheck();
    response.json({
      service: "sidecar",
      status: adapterHealth.status === "ok" ? "ok" : "degraded",
      time: new Date().toISOString(),
      checks: [
        {
          name: adapterHealth.name,
          status: adapterHealth.status,
          details: adapterHealth.details,
        },
      ],
    });
  });

  router.get("/sidecar/snapshot", async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source),
    });
  });

  router.get("/sidecar/summary", async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.summary,
      runtimeStatuses: snapshot.runtimeStatuses,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source),
    });
  });

  router.get("/sidecar/agents", async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.agents,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source),
        count: snapshot.agents.length,
      },
    });
  });

  router.get("/sidecar/agents/:id", async (request, response) => {
    const snapshot = await service.getSnapshot();
    const agent = snapshot.agents.find((candidate) => candidate.id === request.params.id);

    if (!agent) {
      const body: ErrorResponse = {
        error: {
          code: "AGENT_NOT_FOUND",
          message: `Agent ${request.params.id} was not found`,
        },
        meta: createResponseMeta(snapshot.generatedAt, snapshot.source),
      };
      response.status(404).json(body);
      return;
    }

    response.json({
      data: agent,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source),
    });
  });

  router.get("/sidecar/workspaces", async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.workspaces,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source),
        count: snapshot.workspaces.length,
      },
    });
  });

  router.get("/sidecar/sessions", async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.sessions,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source),
        count: snapshot.sessions.length,
      },
    });
  });

  router.get("/sidecar/bindings", async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.bindings,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source),
        count: snapshot.bindings.length,
      },
    });
  });

  router.get("/sidecar/auth-profiles", async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.authProfiles,
      meta: {
        ...createResponseMeta(snapshot.generatedAt, snapshot.source),
        count: snapshot.authProfiles.length,
      },
    });
  });

  router.get("/sidecar/topology", async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.topology,
      meta: createResponseMeta(snapshot.generatedAt, snapshot.source),
    });
  });

  return router;
}
