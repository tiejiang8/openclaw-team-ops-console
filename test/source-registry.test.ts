import assert from "node:assert/strict";
import test from "node:test";

import { buildMockSnapshot } from "../apps/sidecar/src/adapters/mock/mock-data.js";
import { buildSourceRegistry } from "../apps/sidecar/src/domain/source-registry.js";

test("source registry captures collected and planned read-only collections", () => {
  const snapshot = buildMockSnapshot("partial-coverage");
  const registry = buildSourceRegistry(snapshot);

  assert.ok(registry.collections.some((collection) => collection.key === "agents" && collection.sourceKind === "mock"));
  assert.ok(
    registry.collections.some(
      (collection) =>
        collection.key === "authProfiles" && collection.coverage === "unavailable" && collection.warningCount > 0,
    ),
  );
  assert.ok(
    registry.collections.some(
      (collection) =>
        collection.key === "logs" && collection.sourceKind === "filesystem" && collection.coverage === "unavailable",
    ),
  );
  assert.ok(
    registry.collections.some(
      (collection) =>
        collection.key === "plugins" && collection.sourceKind === "gateway-ws" && collection.coverage === "unavailable",
    ),
  );
});
