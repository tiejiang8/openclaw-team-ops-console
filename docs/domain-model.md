# Domain Model

Canonical source of truth for domain entities lives in `packages/shared/src/domain.ts`.

## Entities

### Agent

- identity: `id`, `name`, `role`
- ownership: `workspaceId`, `authProfileId`
- runtime: `status`, `host`, `runtimeVersion`, `lastHeartbeatAt`, `uptimeSeconds`
- metadata: `tags`, `createdAt`, `updatedAt`

### Workspace

- identity: `id`, `name`
- posture: `status`, `environment`
- ownership/placement: `ownerTeam`, `region`
- metadata: `createdAt`, `updatedAt`

### Session

- identity: `id`
- links: `workspaceId`, `agentId`, `bindingId`
- lifecycle: `status`, `startedAt`, `lastActivityAt`
- channel/load: `channel`, `messageCount`

### BindingRoute

- identity: `id`, `routeType`
- links: `workspaceId`, `targetAgentId`
- endpoint/source: `source`
- lifecycle: `status`, `description`, `createdAt`, `updatedAt`

### AuthProfile

- identity: `id`, `name`, `provider`
- lifecycle: `status`, `expiresAt`, `lastUsedAt`
- scope links: `scopes`, `workspaceIds`
- metadata: `createdAt`, `updatedAt`

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

- source metadata (`source`, `generatedAt`)
- all entity arrays
- `runtimeStatuses`
- `summary`
- `topology`

### TopologyView

- `nodes`: typed references for all entities
- `edges`: relationships between entities (`contains-agent`, `owns-session`, etc.)
