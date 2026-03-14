import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMockSnapshot,
  DEFAULT_MOCK_SCENARIO,
  normalizeMockScenario,
} from "../apps/sidecar/src/adapters/mock/mock-data.js";

test("baseline mock snapshot is the default complete scenario", () => {
  const snapshot = buildMockSnapshot(DEFAULT_MOCK_SCENARIO);

  assert.equal(normalizeMockScenario("unknown-scenario"), DEFAULT_MOCK_SCENARIO);
  assert.equal(snapshot.source, "mock");
  assert.equal(snapshot.origin.adapterName, "MockOpenClawAdapter");
  assert.equal(snapshot.collections.agents.status, "complete");
  assert.equal(snapshot.collections.topology.freshness, "fresh");
  assert.ok(snapshot.runtimeStatuses.some((status) => status.componentId === "gateway-probe"));
  assert.ok(snapshot.warnings.some((warning) => warning.code === "MOCK_MODE_ACTIVE"));
});

test("partial coverage scenario marks unavailable and partial collections", () => {
  const snapshot = buildMockSnapshot("partial-coverage");
  const partialAgent = snapshot.agents.find((agent) => agent.id === "ag-partner-observer-01");

  assert.equal(snapshot.collections.authProfiles.status, "unavailable");
  assert.equal(snapshot.authProfiles.length, 0);
  assert.equal(snapshot.collections.sessions.status, "partial");
  assert.equal(snapshot.collections.topology.status, "partial");
  assert.equal(partialAgent ? "authProfileId" in partialAgent : false, false);
  assert.ok(snapshot.topology.edges.every((edge) => edge.fromId.length > 0 && edge.toId.length > 0));
});

test("stale observability scenario exposes stale freshness and offline dependencies", () => {
  const snapshot = buildMockSnapshot("stale-observability");
  const gatewayProbe = snapshot.runtimeStatuses.find((status) => status.componentId === "gateway-probe");

  assert.equal(snapshot.collections.sessions.freshness, "stale");
  assert.equal(snapshot.collections.runtimeStatuses.freshness, "stale");
  assert.equal(gatewayProbe?.status, "offline");
  assert.ok(snapshot.warnings.some((warning) => warning.code === "STALE_COLLECTIONS"));
});
