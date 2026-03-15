# Roadmap v0.2

## Current status

The repository now has the core v0.2 governance spine in place:

- `Target Registry`
- `Evidence`
- `Findings`
- `Risks Summary`
- `Recommendations`
- governance pages in `overlay-web`

## Delivered in the current implementation

### 1) Governance model

- `Target` domain model
- target-scoped summary contract
- explicit `Evidence`, `Finding`, `Recommendation`, and `RisksSummary` models

### 2) Governance API

- `GET /api/targets`
- `GET /api/targets/:id`
- `GET /api/targets/:id/summary`
- `GET /api/evidence`
- `GET /api/evidence/:id`
- `GET /api/findings`
- `GET /api/findings/:id`
- `GET /api/recommendations`
- `GET /api/recommendations/:id`
- `GET /api/risks/summary`

### 3) Governance UI

- `Targets`
- `Target Detail`
- `Risks`
- `Findings`
- `Finding Detail`
- `Evidence`
- `Evidence Detail`

### 4) Multi-target readiness

- `SIDECAR_TARGETS_FILE` support
- mixed `mock` and `filesystem` targets in one console instance
- target-level source metadata, coverage, warning count, and risk score

## Remaining work before a full v0.2 release recommendation

### 1) Review artifacts

- capture screenshots for governance pages
- add test logs and reviewer evidence artifacts
- finish acceptance checklist with final pass/fail counts

### 2) UX and traceability refinement

- richer resource-to-evidence cross-links from inventory pages
- tighter target-scoped resource drill-down flows
- optional saved reviewer presets for common governance filters

### 3) Test depth

- expand browser-level E2E coverage beyond the current minimum governance drill-down flow
- optional DTO snapshot tests for governance responses

## Still deferred beyond v0.2

- write-back workflows
- privileged control actions
- chat UX
- RBAC implementation
- approval workflow engine
- real-time event bus
- remote execution
