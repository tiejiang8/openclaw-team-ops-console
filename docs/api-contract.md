# API Contract (v0.1)

Primary contract is implemented in `apps/overlay-api` and typed in `packages/shared/src/contracts.ts`.

## Health

### `GET /health`

Returns overlay-api health and sidecar dependency health.

## Inventory Summary

### `GET /api/summary`

Returns:

- `InventorySummary` (`data`)
- `runtimeStatuses`
- read-only `meta`

## Agents

### `GET /api/agents`

Returns `ListResponse<Agent>`.

### `GET /api/agents/:id`

Returns `ItemResponse<Agent>`, or `404` with `ErrorResponse`.

## Workspaces

### `GET /api/workspaces`

Returns `ListResponse<Workspace>`.

## Sessions

### `GET /api/sessions`

Returns `ListResponse<Session>`.

## Bindings

### `GET /api/bindings`

Returns `ListResponse<BindingRoute>`.

## Auth Profiles

### `GET /api/auth-profiles`

Returns `ListResponse<AuthProfile>`.

## Topology

### `GET /api/topology`

Returns `TopologyResponse` containing nodes and relationship edges.

## Runtime Status

### `GET /api/runtime-status`

Returns runtime status list aggregated from sidecar and overlay-api process context.

## Response Meta

Most successful payloads include:

- `meta.generatedAt`
- `meta.source` (`mock`, `openclaw`, or `mixed`)
- `meta.readOnly = true`

## v0.1 Guarantees

- GET-only API surface
- no mutation routes
- no write-through behavior to OpenClaw systems
