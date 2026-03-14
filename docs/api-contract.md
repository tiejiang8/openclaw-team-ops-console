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
- `meta.collections` with per-collection freshness, status, and counts
- `meta.warnings` when the snapshot is partial, stale, or otherwise degraded

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
- optional `meta.collections`
- optional `meta.warnings`

List endpoints expose collection-level metadata for their primary collection. Summary responses can expose metadata for all collections carried by the snapshot.

## Degraded-mode Contract

Phase 1.2 hardens the API contract for future real adapters:

- entity records may omit non-identity fields that are unavailable from an external source
- collection metadata distinguishes `complete`, `partial`, and `unavailable` coverage
- freshness distinguishes `fresh`, `stale`, and `unknown`
- topology edges are omitted instead of emitting broken references when upstream identifiers are missing
- sidecar and overlay-api still return read-only responses in degraded and failure cases

## Error Responses

Read failures still preserve the read-only contract:

- sidecar returns `ADAPTER_UNAVAILABLE`
- overlay-api returns `UPSTREAM_UNAVAILABLE`

## v0.1 Guarantees

- GET-only API surface
- no mutation routes
- no write-through behavior to OpenClaw systems
