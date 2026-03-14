import assert from "node:assert/strict";
import test from "node:test";

import { buildTopologyView, createCollectionMetadata, createResponseMeta, type SnapshotWarning } from "../packages/shared/dist/index.js";

test("buildTopologyView skips edges when required identifiers are missing or unresolved", () => {
  const topology = buildTopologyView({
    generatedAt: "2026-03-14T00:00:00.000Z",
    workspaces: [
      {
        id: "ws-1",
        name: "Workspace One",
        status: "healthy",
      },
    ],
    agents: [
      {
        id: "ag-1",
        name: "Agent One",
        role: "worker",
        status: "healthy",
        workspaceId: "ws-1",
        authProfileId: "auth-1",
      },
      {
        id: "ag-2",
        name: "Agent Two",
        role: "observer",
        status: "degraded",
        authProfileId: "auth-missing",
      },
    ],
    sessions: [
      {
        id: "sess-1",
        status: "active",
        channel: "discord",
        workspaceId: "ws-1",
        agentId: "ag-1",
        bindingId: "binding-missing",
      },
    ],
    bindings: [
      {
        id: "binding-1",
        routeType: "channel",
        source: "discord:#ops",
        targetAgentId: "ag-1",
        status: "active",
      },
    ],
    authProfiles: [
      {
        id: "auth-1",
        name: "Auth Profile One",
        provider: "token",
        status: "valid",
      },
    ],
  });

  assert.deepEqual(
    topology.edges.map((edge) => edge.relation).sort(),
    ["authenticates-agent", "contains-agent", "contains-session", "owns-session", "targets-agent"].sort(),
  );
  assert.ok(topology.edges.every((edge) => edge.fromId.length > 0 && edge.toId.length > 0));
});

test("createResponseMeta carries collection metadata and snapshot warnings", () => {
  const warning: SnapshotWarning = {
    code: "PARTIAL_COLLECTION",
    severity: "warn",
    message: "Agents collection is partial.",
    collection: "agents",
  };
  const agentsCollection = createCollectionMetadata({
    collection: "agents",
    status: "partial",
    freshness: "stale",
    collectedAt: "2026-03-14T00:00:00.000Z",
    recordCount: 3,
    warnings: [warning],
  });

  const meta = createResponseMeta("2026-03-14T00:05:00.000Z", "mixed", {
    collections: {
      agents: agentsCollection,
    },
    warnings: [warning],
  });

  assert.equal(meta.readOnly, true);
  assert.equal(meta.collections?.agents?.status, "partial");
  assert.equal(meta.collections?.agents?.freshness, "stale");
  assert.equal(meta.warnings?.[0]?.code, "PARTIAL_COLLECTION");
});
