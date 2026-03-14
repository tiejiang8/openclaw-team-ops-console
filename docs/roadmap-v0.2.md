# Roadmap v0.2

## Objective

Expand from mock-backed visibility to real-source operational visibility while preserving sidecar boundaries and read-focused contracts.

## Planned Workstreams

### 1) Real Adapter Implementations

- add adapter(s) that read from externally exposed OpenClaw sources
- retain mock adapter for offline demo/dev mode
- add adapter selection configuration (`mock`, `openclaw`, hybrid fallback)

### 2) Enhanced Observability

- lightweight periodic refresh and snapshot diffing
- trend panels for inventory deltas
- warning surfacing for stale heartbeats and expiring auth profiles

### 3) Reliability

- retries/timeouts/circuit patterns between overlay-api and sidecar
- adapter health diagnostics with richer reason codes
- graceful degradation in UI when subsets are unavailable

### 4) API Contract Hardening

- pagination and query filters for large inventories
- versioned API namespace strategy (`/api/v1`)
- schema validation and contract tests

### 5) UI Improvements for Team Ops

- saved filters for operations teams
- deep-linking to entities from topology edges
- denser tables for high-scale inventories

## Deferred (still not default v0.2)

- mutating controls
- write-back workflows
- embedded chat or prompt editors
- full RBAC implementation

These remain explicitly out of scope unless approved for a later product phase.
