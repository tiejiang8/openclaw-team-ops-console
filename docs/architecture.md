# Architecture

## Product

- **Name:** OpenClaw Team Ops Console
- **Positioning:** Read-only governance and visibility for OpenClaw runtimes
- **Current status:** v0.3 alpha governance preview for internal evaluation

## Design Objective

The repository remains a standalone sidecar product. Its purpose is to observe OpenClaw runtimes as external systems, normalize read-only inventory and runtime signals, and surface governance-oriented views such as targets, findings, evidence, and recommendations.

## Component Model

### 1) Sidecar (`apps/sidecar`)

Responsibilities:

- connect only to externally readable sources
- keep adapter boundaries explicit and replaceable
- emit normalized snapshots and target summaries
- stay non-invasive: no runtime hooks, monkey patching, injection, or source imports

Current sources:

- `MockOpenClawAdapter`
- `FilesystemOpenClawAdapter`
- target registry loader via `SIDECAR_TARGETS_FILE`

Current read-only routes:

- `/health`
- `/sidecar/snapshot`
- `/sidecar/summary`
- `/sidecar/targets`
- `/sidecar/targets/:id`
- `/sidecar/targets/:id/summary`
- inventory routes under `/sidecar/*`

### 2) Overlay API (`apps/overlay-api`)

Responsibilities:

- aggregate read-only sidecar data
- expose stable GET-only contracts for the UI
- add governance derivation without mutating upstream state
- publish health, inventory, evidence, findings, risks, and recommendations

Key internal role:

- the governance engine derives `Evidence`, `Finding`, `Recommendation`, and `RisksSummary` from target summaries, warnings, coverage gaps, freshness signals, and relationship mismatches

### 3) Overlay Web (`apps/overlay-web`)

Responsibilities:

- provide enterprise/team-ops visibility, not chat UX
- keep navigation readable across governance and resource layers
- support client-side sort, pagination, filters, density, loading/empty/error/retry states, and URL state persistence

Current governance views:

- `Overview`
- `Targets`
- `Target Detail`
- `Risks`
- `Findings`
- `Finding Detail`
- `Evidence`
- `Evidence Detail`

Current resource views:

- `Agents`
- `Workspaces`
- `Sessions`
- `Bindings`
- `Auth Profiles`
- `Topology`

### 4) Shared Contracts (`packages/shared`)

Responsibilities:

- canonical domain models and DTOs
- target, evidence, finding, recommendation, and risk summary types
- snapshot metadata, coverage, freshness, and warning semantics

## Data Flow

```text
External runtime paths or mock fixtures
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

## Governance Flow

```text
Target -> Target Summary -> Evidence -> Finding -> Recommendation
```

- `Target` describes the observed runtime or mock source
- `Evidence` records normalized facts and degraded signals
- `Finding` turns evidence into operator-facing conclusions
- `Recommendation` provides read-only next checks without executing anything

## Read-only Guarantee

- sidecar and overlay-api remain GET-only
- every response carries read-only metadata
- recommendations are guidance only, never silent execution
- OpenClaw core is treated as an external system

## Default Ports

- Sidecar: `4310`
- Overlay API: `4300`
- Overlay Web: `5173`
