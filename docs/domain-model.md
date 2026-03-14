# Domain Model

Canonical source of truth for domain entities lives in `packages/shared/src/domain.ts`.

## Entities

Entity records now allow missing non-identity fields where a future external adapter may only have partial visibility. Consumers should treat absent fields as "unknown" rather than as an error.

### Agent

- identity: `id`, `name`, `role`
- ownership: optional `workspaceId`, optional `authProfileId`
- runtime: `status`, optional `host`, optional `runtimeVersion`, optional `lastHeartbeatAt`, optional `uptimeSeconds`
- metadata: optional `tags`, optional `createdAt`, optional `updatedAt`

### Workspace

- identity: `id`, `name`
- posture: `status`, optional `environment`
- ownership/placement: optional `ownerTeam`, optional `region`
- metadata: optional `createdAt`, optional `updatedAt`

### Session

- identity: `id`
- optional links: `workspaceId`, `agentId`, `bindingId`
- lifecycle: `status`, optional `startedAt`, optional `lastActivityAt`
- channel/load: `channel`, optional `messageCount`

### BindingRoute

- identity: `id`, `routeType`
- optional links: `workspaceId`, `targetAgentId`
- endpoint/source: `source`
- lifecycle: `status`, optional `description`, optional `createdAt`, optional `updatedAt`

### AuthProfile

- identity: `id`, `name`, `provider`
- lifecycle: `status`, `expiresAt`, `lastUsedAt`
- optional scope links: `scopes`, `workspaceIds`
- metadata: optional `createdAt`, optional `updatedAt`

### RuntimeStatus

- identity: `componentId`, `componentType`
- lifecycle: `status`, `observedAt`
- details: arbitrary key/value map for diagnostics

### InventorySummary

- `totals` for all inventory entity classes
- `activeSessions`
- `statusBreakdown`
- `generatedAt`

### SystemSnapshot

Aggregate read model containing:

- source metadata (`source`, `generatedAt`, `origin`)
- `collections`: per-collection status, freshness, record counts, warnings, and collection timestamps
- `warnings`: snapshot-level degraded-mode warnings
- all entity arrays
- `runtimeStatuses`
- `summary`
- `topology`

### TopologyView

- `nodes`: typed references for all entities
- `edges`: relationships between entities (`contains-agent`, `owns-session`, etc.)

Topology generation skips edges when required identifiers are missing or unresolved, which keeps degraded snapshots valid even when some collections are partial.

## Collection Metadata

Collection metadata is shared across sidecar and overlay-api responses:

- `collection`: logical collection name
- `status`: `complete`, `partial`, or `unavailable`
- `freshness`: `fresh`, `stale`, or `unknown`
- `collectedAt`: last successful collection time for that dataset
- `recordCount`: observed item count for that dataset
- `sourceIds`: source descriptors used for that dataset
- `warnings`: collection-specific warnings

## Source Metadata

`SnapshotOrigin` and `AdapterSourceDescriptor` describe where data came from without coupling this repo to OpenClaw internals:

- adapter name
- mode (`mock` or future `external-readonly`)
- source kind (`mock`, `filesystem`, `cli`, `http`, `websocket`, `composite`)
- confidence (`confirmed` or `assumption`)
