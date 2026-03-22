# API Contract (v0.3 alpha)

Primary contracts are typed in `packages/shared/src/contracts.ts` and implemented by `apps/overlay-api`.

## Global guarantees

- GET-only API surface
- `x-openclaw-ops-readonly: true` on responses
- `meta.readOnly = true`
- degraded and partial data remain explicit through collection metadata and warnings

## Health

### `GET /health`

Returns overlay-api health plus sidecar dependency status.

## Summary and inventory

### `GET /api/summary`
Returns `SummaryResponse`.

### `GET /api/agents`
### `GET /api/agents/:id`
### `GET /api/workspaces`
### `GET /api/workspaces/:id/documents/:fileName`
### `GET /api/sessions`
### `GET /api/bindings`
### `GET /api/auth-profiles`
### `GET /api/topology`
### `GET /api/runtime-status`
Returns `RuntimeStatusResponse`.

This contract now includes:

- gateway configured / auth resolved / connection state
- OpenClaw overall runtime state
- node paired / connected / stale counts
- cron total / enabled / overdue / failing counts
- presence counters and last sync timestamps

### `GET /api/cron`
Returns `CronJobsResponse`.

Supported filters:

- `source`
- `status`
- `q`

### `GET /api/cron/:id`
Returns `CronJobResponse` or `404 CRON_JOB_NOT_FOUND`.

### `GET /api/nodes`
Returns `NodesResponse`.

Supported filters:

- `status`
- `q`

These remain the original read-only inventory contracts.

## Targets

### `GET /api/targets`
Returns `TargetsResponse`.

### `GET /api/targets/:id`
Returns `TargetResponse` or `404 TARGET_NOT_FOUND`.

### `GET /api/targets/:id/summary`
Returns `TargetSummaryResponse` or `404 TARGET_NOT_FOUND`.

`TargetSummaryResponse` now carries target-scoped inventory arrays plus collection metadata, warnings, and runtime statuses.

## Evidence

### `GET /api/evidence`
Returns `EvidencesResponse`.

Supported filters:

- `targetId`
- `severity`
- `kind`
- `subjectType`
- `subjectId`

### `GET /api/evidence/:id`
Returns `EvidenceResponse` or `404 EVIDENCE_NOT_FOUND`.

## Findings

### `GET /api/findings`
Returns `FindingsResponse`.

Supported filters:

- `targetId`
- `severity`
- `type`
- `status`

### `GET /api/findings/:id`
Returns `FindingResponse` or `404 FINDING_NOT_FOUND`.

## Recommendations

### `GET /api/recommendations`
Returns `RecommendationsResponse`.

Supported filters:

- `findingId`

### `GET /api/recommendations/:id`
Returns `RecommendationResponse` or `404 RECOMMENDATION_NOT_FOUND`.

## Risks summary

### `GET /api/risks/summary`
Returns `RisksSummaryResponse`.

This summary aggregates:

- open findings
- severity breakdown
- finding type breakdown
- stale target count
- coverage gap count
- highest risk score
- target-level risk breakdown

## Standardized governance concepts

### `Evidence`
Maps read-only facts such as:

- snapshot warnings
- partial or unavailable collections
- stale freshness signals
- workspace drift indicators
- config include anomalies
- runtime degradation

### `Finding`
Represents operator-facing conclusions with:

- severity
- summary
- target and subject references
- evidence references
- recommendation references
- score

### `Recommendation`
Represents read-only suggested checks with:

- priority
- requiresHuman
- optional `commandTemplate`
- optional `pathHint`
- optional `docLink`
- optional `safetyLevel`

Recommendations do not execute anything.

## Example payloads

See:

- [docs/v0.3-api-examples.md](v0.3-api-examples.md)
- [docs/examples/api/targets.json](examples/api/targets.json)
- [docs/examples/api/findings.json](examples/api/findings.json)
- [docs/examples/api/evidence.json](examples/api/evidence.json)
- [docs/examples/api/risks-summary.json](examples/api/risks-summary.json)
