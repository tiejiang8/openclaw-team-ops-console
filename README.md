# OpenClaw Team Ops Console

**OpenClaw Multi-Agent Control**

A standalone, read-only operations console for team and enterprise visibility across OpenClaw deployments.

## v0.1 Scope

This release is intentionally **read-only** and focused on operational observability:

- agent inventory
- workspace inventory
- session inventory
- binding/route inventory
- auth profile inventory
- runtime health and status overview
- topology and relationship view

## Phase 1.1 UX Enhancements

Phase 1.1 keeps the same read-only architecture and adds usability improvements only:

- client-side sorting on inventory/topology tables
- client-side pagination with page-size controls
- table density toggle (`comfortable` / `compact`)
- URL-persisted table state (search, filters, sorting, pagination, density)
- consistent loading, empty, and error states with retry for read requests
- clearer overview drill-down paths into inventory pages

## Core Constraints

- OpenClaw core remains untouched.
- This repo treats OpenClaw as an external system.
- No runtime patching, monkey patching, or code injection.
- No write-back actions in v0.1.

## Architecture

- `apps/sidecar`: source-facing adapters (mock-first in v0.1)
- `apps/overlay-api`: read-only aggregation API for normalized data
- `apps/overlay-web`: standalone operations UI
- `packages/shared`: domain models and API contracts

```text
openclaw-team-ops-console/
  apps/
    overlay-api/
    overlay-web/
    sidecar/
  packages/
    shared/
  docs/
    api-contract.md
    architecture.md
    domain-model.md
    integration-boundaries.md
    roadmap-v0.2.md
    table-state-utilities.md
```

## Local Development

Requirements:

- Node 22+
- pnpm 10+

Install and run:

```bash
corepack pnpm install
corepack pnpm dev
```

Default local ports:

- Sidecar: `http://localhost:4310`
- Overlay API: `http://localhost:4300`
- Overlay Web: `http://localhost:5173`

Build and typecheck:

```bash
corepack pnpm typecheck
corepack pnpm build
```

Environment variables (all optional in v0.1):

- `SIDECAR_PORT` (default: `4310`)
- `OVERLAY_API_PORT` (default: `4300`)
- `SIDECAR_BASE_URL` (default: `http://localhost:4310`)
- `SIDECAR_TIMEOUT_MS` (default: `5000`)
- `VITE_OVERLAY_API_URL` (default: `http://localhost:4300`)

## API Surface (Overlay API)

- `GET /health`
- `GET /api/summary`
- `GET /api/agents`
- `GET /api/agents/:id`
- `GET /api/workspaces`
- `GET /api/sessions`
- `GET /api/bindings`
- `GET /api/auth-profiles`
- `GET /api/topology`
- `GET /api/runtime-status`

All endpoints are read-only and return inventory snapshots/DTOs only.

## Notes for Adapter Integration

v0.1 ships with a mock sidecar adapter so the console runs independently.

Future OpenClaw integration should be implemented by adding new adapter implementations behind the existing sidecar adapter interface in `apps/sidecar/src/adapters`.

No OpenClaw core source changes are required.

## Docs

- `docs/architecture.md`
- `docs/domain-model.md`
- `docs/api-contract.md`
- `docs/integration-boundaries.md`
- `docs/roadmap-v0.2.md`
- `docs/table-state-utilities.md`
