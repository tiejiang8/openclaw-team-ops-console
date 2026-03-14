# Architecture

## Product

- **Name:** OpenClaw Team Ops Console
- **Descriptor:** OpenClaw Multi-Agent Control

## Design Objective (v0.1 / v0.1.4)

Provide a standalone, read-only operational console for team visibility. The system prioritizes inventory and runtime observability over interactive agent control.

## Component Model

### 1) Sidecar (`apps/sidecar`)

Responsibilities:

- connect to existing exposed data sources only
- isolate source-specific access behind adapter interfaces
- emit normalized inventory snapshots
- remain non-invasive (no runtime hooks, monkey patching, injection)

v0.1 implementation:

- mock adapter (`MockOpenClawAdapter`) remains the default path
- filesystem adapter (`FilesystemOpenClawAdapter`) reads documented local OpenClaw runtime/config/workspace files in read-only mode
- sidecar endpoints exposed under `/sidecar/*`
- adapter capabilities and source descriptors define future real-adapter boundaries
- mock scenarios remain the default runtime path unless local runtime paths are configured

### 2) Overlay API (`apps/overlay-api`)

Responsibilities:

- consume sidecar read-only data
- expose stable REST contract for UI
- return normalized DTOs from shared contracts
- provide service and dependency health status

Behavior:

- no mutating endpoints
- API responses include read-only metadata (`readOnly: true`)
- response metadata can include per-collection freshness, status, and warnings

### 3) Overlay Web (`apps/overlay-web`)

Responsibilities:

- admin/team operations interface (not chat UX)
- inventory-first workflows (tables, counts, filters)
- relationship and topology views

Views:

- Overview
- Agents
- Workspaces
- Sessions
- Bindings
- Auth Profiles
- Topology

### 4) Shared Contracts (`packages/shared`)

Responsibilities:

- canonical domain models
- API DTO response types
- summary/topology builders
- collection metadata and snapshot warning semantics for degraded sources

## Data Flow

```text
[Data Source Adapter]
       |
       v
   Sidecar
       |
       v
  Overlay API
       |
       v
  Overlay Web
```

In v0.1, mock mode remains the default. Phase 1.4 adds an optional local filesystem adapter without changing the API/UI architecture. Later phases can add CLI or gateway-based adapters without requiring API/UI architecture rewrites.

Phase 1.2 adds explicit support for:

- partial and unavailable fields in entity records
- per-collection status (`complete`, `partial`, `unavailable`)
- per-collection freshness (`fresh`, `stale`, `unknown`)
- source descriptors for mock or future external collectors
- snapshot warnings that can surface degraded collection behavior without introducing write paths

## Snapshot Shape

Each `SystemSnapshot` now includes:

- `origin`: adapter name, collection mode, and source descriptors
- `collections`: collection-level metadata for inventory and topology
- `warnings`: snapshot-wide warnings for degraded or incomplete collection
- entity arrays, runtime statuses, summary, and topology

This keeps degraded external reads explicit instead of forcing the API or web layer to guess why data is missing.

## Runtime Ports

- Sidecar: `4310`
- Overlay API: `4300`
- Overlay Web: `5173`

## Read-only Guarantee

- Sidecar and Overlay API expose GET-only operational inventory routes.
- No create/update/delete operations exist in v0.1.
- Real adapter work must use externally exposed read-only surfaces only.
