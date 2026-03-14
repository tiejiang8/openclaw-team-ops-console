# Mock Scenarios

Mock mode remains the default runtime for Phase 1.x.

Use `SIDECAR_MOCK_SCENARIO` to switch scenarios while keeping the product standalone and read-only.

## Default

- `baseline`

This is the default scenario used when no env var is provided.

It represents a healthy enterprise-style environment with multiple workspaces, agents, bindings, auth profiles, and runtime components.

## Available Scenarios

### `baseline`

Use when you want:

- normal local development
- healthy inventory and topology coverage
- complete collection metadata

Characteristics:

- all collections marked `complete`
- freshness marked `fresh`
- snapshot warning indicates mock mode only

### `partial-coverage`

Use when you want to test:

- missing optional fields
- unavailable collections
- incomplete topology relationships

Characteristics:

- auth profiles marked `unavailable`
- sessions, bindings, topology, and runtime marked `partial`
- selected fields are omitted from records to simulate degraded external visibility

### `stale-observability`

Use when you want to test:

- stale timestamps
- degraded runtime posture
- cached inventory after upstream failures

Characteristics:

- multiple collections marked `stale`
- runtime dependency includes an offline gateway probe
- snapshot warning indicates cached or stale data

### `error-upstream`

Use when you want to test:

- sidecar adapter failure handling
- overlay-api read-only error responses

Characteristics:

- adapter health reports `down`
- snapshot collection throws intentionally
- overlay-api returns `UPSTREAM_UNAVAILABLE`

## Local Usage

Examples:

```bash
SIDECAR_MOCK_SCENARIO=baseline corepack pnpm dev
SIDECAR_MOCK_SCENARIO=partial-coverage corepack pnpm dev
SIDECAR_MOCK_SCENARIO=stale-observability corepack pnpm dev
```

Failure-path testing:

```bash
SIDECAR_MOCK_SCENARIO=error-upstream corepack pnpm dev
```

## Why These Scenarios Exist

They let us validate the standalone console against realistic enterprise inventory shapes and degraded-source behavior before any real OpenClaw adapter is introduced.
