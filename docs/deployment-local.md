# Local Deployment

This document covers the supported local startup paths for the v0.1 alpha package.

## Supported Modes

### 1. Process mode

Runs the three applications directly from this repository:

- sidecar
- overlay-api
- overlay-web

### 2. Container mode

Runs the same architecture with Docker Compose in default mock mode.

## Environment Setup

Create a local env file if you want to override defaults:

```bash
cp .env.example .env
```

Default behavior is already suitable for local evaluation.
Mock mode remains the default when no `OPENCLAW_*` runtime paths are configured.

## Process-mode Startup

Install:

```bash
corepack pnpm install
```

Start:

```bash
corepack pnpm dev
```

URLs:

- Overlay Web: `http://localhost:5173`
- Overlay API: `http://localhost:4300`
- Sidecar: `http://localhost:4310`

### Notes

- overlay-web uses same-origin `/api` and `/health` routing by default
- Vite proxies those requests to overlay-api during local development
- sidecar logs the active mock scenario on startup

## Optional Local OpenClaw Path Mode

Phase 1.4 adds a read-only filesystem adapter for local OpenClaw runtime inspection.

Use it when you want this standalone console to read documented OpenClaw files from the same machine without importing OpenClaw code.

Typical startup:

```bash
OPENCLAW_RUNTIME_ROOT=~/.openclaw \
OPENCLAW_WORKSPACE_GLOB='~/.openclaw/workspace*' \
OPENCLAW_SOURCE_ROOT=~/openclaw \
corepack pnpm dev
```

Behavior:

- `OPENCLAW_CONFIG_FILE` is optional; when omitted and `OPENCLAW_RUNTIME_ROOT` is set, sidecar reads `${OPENCLAW_RUNTIME_ROOT}/openclaw.json`
- missing paths do not switch back to mock mode; they surface as warnings and `partial` or `unavailable` collections
- `OPENCLAW_SOURCE_ROOT` is informational only and does not activate filesystem mode by itself

Supported files and path details are documented in `docs/local-path-integration.md`.

## Container Startup

The provided Compose setup does not mount an OpenClaw runtime directory by default. Local path-based integration is currently documented for process mode.

Start:

```bash
docker compose up --build
```

URLs:

- Overlay Web: `http://localhost:5173`
- Overlay API: `http://localhost:4300`
- Sidecar: `http://localhost:4310`

Stop:

```bash
docker compose down --remove-orphans
```

Follow logs:

```bash
docker compose logs -f
```

## Healthchecks

Compose includes healthchecks for:

- sidecar: `GET /health`
- overlay-api: `GET /health`
- overlay-web: `GET /ready`

These healthchecks are intended for local operator confidence and compose dependency ordering.

## Mock Scenarios

Recommended scenarios for local review:

- `baseline`
- `partial-coverage`
- `stale-observability`

Example:

```bash
SIDECAR_MOCK_SCENARIO=partial-coverage docker compose up --build
```

## Quality Verification

```bash
corepack pnpm guard:readonly
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Safe Reset

To clear generated artifacts without touching source files:

```bash
corepack pnpm dev:reset
```

## Boundary Reminder

This repo remains:

- standalone
- mock-first by default
- read-only
- independent of any OpenClaw core patch or source import
