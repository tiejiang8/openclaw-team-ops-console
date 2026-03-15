import {
  createItemResponse,
  createListResponse,
  createResponseMeta,
  type CollectionName,
  type ErrorResponse,
  type SnapshotWarning,
} from "@openclaw-team-ops/shared";
import type { NextFunction, Request, Response, Router } from "express";
import express from "express";

import type { SidecarInventoryAdapter } from "../adapters/source-adapter.js";
import type { SidecarService } from "../services/sidecar-service.js";

export function createSidecarRouter(service: SidecarService, adapter: SidecarInventoryAdapter): Router {
  const router = express.Router();
  const selectCollection = (snapshot: Awaited<ReturnType<SidecarService["getSnapshot"]>>, collection: CollectionName) => ({
    [collection]: snapshot.collections[collection],
  });
  const selectCollectionStatuses = (
    snapshot: Awaited<ReturnType<SidecarService["getSnapshot"]>>,
    ...keys: string[]
  ) => snapshot.sourceRegistry.collections.filter((collection) => keys.includes(collection.key));
  const buildSnapshotMeta = (
    snapshot: Awaited<ReturnType<SidecarService["getSnapshot"]>>,
    options?: Parameters<typeof createResponseMeta>[2],
  ) =>
    createResponseMeta(snapshot.generatedAt, snapshot.source, {
      collectionStatuses: options?.collectionStatuses ?? snapshot.sourceRegistry.collections,
      ...(options?.collections ? { collections: options.collections } : {}),
      warnings: options?.warnings ?? snapshot.warnings,
      ...(options?.sourceKinds ? { sourceKinds: options.sourceKinds } : {}),
      ...(options?.targetId ? { targetId: options.targetId } : {}),
      ...(options?.fetchedAt ? { fetchedAt: options.fetchedAt } : {}),
      ...(options?.freshness ? { freshness: options.freshness } : {}),
      ...(options?.coverage ? { coverage: options.coverage } : {}),
    });
  const withWarnings = (warnings?: SnapshotWarning[]) =>
    warnings && warnings.length > 0 ? { warnings } : {};
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
    response.json(createItemResponse(snapshot, buildSnapshotMeta(snapshot, { collections: snapshot.collections })));
  }));

  router.get("/sidecar/summary", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json({
      data: snapshot.summary,
      item: snapshot.summary,
      runtimeStatuses: snapshot.runtimeStatuses,
      meta: buildSnapshotMeta(snapshot, {
        collections: snapshot.collections,
      }),
    });
  }));

  router.get("/sidecar/coverage", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json(
      createItemResponse(
        snapshot.sourceRegistry,
        buildSnapshotMeta(snapshot, {
          collections: snapshot.collections,
        }),
      ),
    );
  }));

  router.get("/sidecar/logs/files", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    const result = await service.getLogFiles();

    response.json(
      createListResponse(
        result.items,
        buildSnapshotMeta(snapshot, {
          collectionStatuses: [result.collectionStatus],
          sourceKinds: [result.collectionStatus.sourceKind],
          ...(result.warnings ? { warnings: result.warnings } : {}),
        }),
      ),
    );
  }));

  router.get("/sidecar/logs/summary", handleAsync(async (request, response) => {
    const snapshot = await service.getSnapshot();
    const result = await service.getLogSummary(typeof request.query.date === "string" ? request.query.date : undefined);

    response.json(
      createItemResponse(
        result.item,
        buildSnapshotMeta(snapshot, {
          collectionStatuses: [result.collectionStatus],
          sourceKinds: [result.collectionStatus.sourceKind],
          ...(result.warnings ? { warnings: result.warnings } : {}),
        }),
      ),
    );
  }));

  router.get("/sidecar/logs/entries", handleAsync(async (request, response) => {
    const snapshot = await service.getSnapshot();
    const limit =
      typeof request.query.limit === "string" && request.query.limit.trim().length > 0
        ? Number.parseInt(request.query.limit, 10)
        : undefined;
    const result = await service.getLogEntries({
      ...(typeof request.query.date === "string" ? { date: request.query.date } : {}),
      ...(typeof request.query.cursor === "string" ? { cursor: request.query.cursor } : {}),
      ...(typeof limit === "number" && !Number.isNaN(limit) ? { limit } : {}),
      ...(typeof request.query.q === "string" ? { q: request.query.q } : {}),
      ...(typeof request.query.level === "string" ? { level: request.query.level } : {}),
      ...(typeof request.query.subsystem === "string" ? { subsystem: request.query.subsystem } : {}),
      ...(typeof request.query.tag === "string" ? { tag: request.query.tag } : {}),
    });

    response.json(
      createItemResponse(
        result.item,
        buildSnapshotMeta(snapshot, {
          collectionStatuses: [result.collectionStatus],
          sourceKinds: [result.collectionStatus.sourceKind],
          ...(result.warnings ? { warnings: result.warnings } : {}),
        }),
      ),
    );
  }));

  router.get("/sidecar/logs/files/:date/raw", handleAsync(async (request, response) => {
    const snapshot = await service.getSnapshot();
    const result = await service.getLogRawFile(request.params.date);

    if (!result.item) {
      const body: ErrorResponse = {
        error: {
          code: "LOG_FILE_NOT_FOUND",
          message: `Log file for ${request.params.date} was not found`,
        },
        meta: buildSnapshotMeta(snapshot, {
          collectionStatuses: [result.collectionStatus],
          sourceKinds: [result.collectionStatus.sourceKind],
          ...(result.warnings ? { warnings: result.warnings } : {}),
        }),
      };
      response.status(404).json(body);
      return;
    }

    response.json(
      createItemResponse(
        result.item,
        buildSnapshotMeta(snapshot, {
          collectionStatuses: [result.collectionStatus],
          sourceKinds: [result.collectionStatus.sourceKind],
          ...(result.warnings ? { warnings: result.warnings } : {}),
        }),
      ),
    );
  }));

  router.get("/sidecar/targets", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    const targets = await service.getTargets();
    response.json(createListResponse(targets, buildSnapshotMeta(snapshot)));
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
        meta: buildSnapshotMeta(snapshot),
      };
      response.status(404).json(body);
      return;
    }

    response.json(createItemResponse(target, buildSnapshotMeta(snapshot)));
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
        meta: buildSnapshotMeta(snapshot),
      };
      response.status(404).json(body);
      return;
    }

    response.json(createItemResponse(targetSummary, buildSnapshotMeta(snapshot, { collections: snapshot.collections })));
  }));

  router.get("/sidecar/agents", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json(createListResponse(snapshot.agents, buildSnapshotMeta(snapshot, { collections: selectCollection(snapshot, "agents") })));
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
        meta: buildSnapshotMeta(snapshot, { collections: selectCollection(snapshot, "agents") }),
      };
      response.status(404).json(body);
      return;
    }

    response.json(createItemResponse(agent, buildSnapshotMeta(snapshot, { collections: selectCollection(snapshot, "agents") })));
  }));

  router.get("/sidecar/workspaces", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json(
      createListResponse(snapshot.workspaces, buildSnapshotMeta(snapshot, { collections: selectCollection(snapshot, "workspaces") })),
    );
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
        meta: buildSnapshotMeta(snapshot, { collections: selectCollection(snapshot, "workspaces") }),
      };
      response.status(404).json(body);
      return;
    }

    response.json(
      createItemResponse(document, buildSnapshotMeta(snapshot, { collections: selectCollection(snapshot, "workspaces") })),
    );
  }));

  router.get("/sidecar/sessions", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json(
      createListResponse(
        snapshot.sessions,
        buildSnapshotMeta(snapshot, {
          collections: selectCollection(snapshot, "sessions"),
          collectionStatuses: selectCollectionStatuses(snapshot, "sessions"),
        }),
      ),
    );
  }));

  router.get("/sidecar/presence", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    const result = await adapter.getPresence();

    response.json(
      createListResponse(
        result.items,
        buildSnapshotMeta(snapshot, {
          collectionStatuses: [result.collectionStatus],
          sourceKinds: [result.collectionStatus.sourceKind],
          ...withWarnings(result.warnings),
        }),
      ),
    );
  }));

  router.get("/sidecar/nodes", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    const result = await adapter.getNodes();

    response.json(
      createListResponse(
        result.items,
        buildSnapshotMeta(snapshot, {
          collectionStatuses: [result.collectionStatus],
          sourceKinds: [result.collectionStatus.sourceKind],
          ...withWarnings(result.warnings),
        }),
      ),
    );
  }));

  router.get("/sidecar/tools", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    const result = await adapter.getTools();

    response.json(
      createListResponse(
        result.items,
        buildSnapshotMeta(snapshot, {
          collectionStatuses: [result.collectionStatus],
          sourceKinds: [result.collectionStatus.sourceKind],
          ...withWarnings(result.warnings),
        }),
      ),
    );
  }));

  router.get("/sidecar/plugins", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    const result = await adapter.getPlugins();

    response.json(
      createListResponse(
        result.items,
        buildSnapshotMeta(snapshot, {
          collectionStatuses: [result.collectionStatus],
          sourceKinds: [result.collectionStatus.sourceKind],
          ...withWarnings(result.warnings),
        }),
      ),
    );
  }));

  router.get("/sidecar/bindings", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json(createListResponse(snapshot.bindings, buildSnapshotMeta(snapshot, { collections: selectCollection(snapshot, "bindings") })));
  }));

  router.get("/sidecar/auth-profiles", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json(
      createListResponse(snapshot.authProfiles, buildSnapshotMeta(snapshot, { collections: selectCollection(snapshot, "authProfiles") })),
    );
  }));

  router.get("/sidecar/topology", handleAsync(async (_request, response) => {
    const snapshot = await service.getSnapshot();
    response.json(
      createItemResponse(snapshot.topology, buildSnapshotMeta(snapshot, { collections: selectCollection(snapshot, "topology") })),
    );
  }));

  return router;
}
