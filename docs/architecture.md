# Architecture

## Product

- **Name:** OpenClaw Team Ops Console
- **Descriptor:** OpenClaw Multi-Agent Control

## Design Objective (v0.1)

Provide a standalone, read-only operational console for team visibility. The system prioritizes inventory and runtime observability over interactive agent control.

## Component Model

### 1) Sidecar (`apps/sidecar`)

Responsibilities:

- connect to existing exposed data sources only
- isolate source-specific access behind adapter interfaces
- emit normalized inventory snapshots
- remain non-invasive (no runtime hooks, monkey patching, injection)

v0.1 implementation:

- mock adapter (`MockOpenClawAdapter`)
- sidecar endpoints exposed under `/sidecar/*`

### 2) Overlay API (`apps/overlay-api`)

Responsibilities:

- consume sidecar read-only data
- expose stable REST contract for UI
- return normalized DTOs from shared contracts
- provide service and dependency health status

Behavior:

- no mutating endpoints
- API responses include read-only metadata (`readOnly: true`)

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

In v0.1, the adapter is mock data. In later phases, the adapter implementation changes without requiring API/UI architecture rewrites.

## Runtime Ports

- Sidecar: `4310`
- Overlay API: `4300`
- Overlay Web: `5173`

## Read-only Guarantee

- Sidecar and Overlay API expose GET-only operational inventory routes.
- No create/update/delete operations exist in v0.1.
