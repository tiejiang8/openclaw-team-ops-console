# Local Deployment

This document covers supported local startup paths for the current v0.2 alpha governance preview.

## Supported modes

### 1. Process mode

Runs the three applications directly from this repository:

- sidecar
- overlay-api
- overlay-web

### 2. Container mode

Runs the same architecture with Docker Compose.

There are now two supported compose paths:

- `docker-compose.yml`
  - mock-first demo compose
- `docker-compose.filesystem.yml`
  - real OpenClaw read-only filesystem compose

## Environment setup

Create a local env file if you want to override defaults:

```bash
cp .env.example .env
```

Default behavior is suitable for local evaluation. Mock mode remains the default unless local runtime paths or a target registry file are configured.

## Process-mode startup

Install:

```bash
corepack pnpm install
```

Start:

```bash
corepack pnpm dev
```

Default URLs:

- Overlay Web: `http://localhost:5173`
- Overlay API: `http://localhost:4300`
- Sidecar: `http://localhost:4310`

### Notes

- overlay-web uses same-origin `/api` and `/health` routing by default
- Vite proxies those requests to overlay-api during local development
- sidecar remains read-only and prints its adapter state on startup
- non-Docker process mode now keeps `4300` and `4310` on `127.0.0.1` by default
- keep `VITE_OVERLAY_API_URL` empty for remote process-mode access so browsers do not call `4300` directly

## Optional local OpenClaw path mode

Use the filesystem adapter when you want this standalone console to read documented OpenClaw files from the same machine without importing OpenClaw code.

Typical startup:

```bash
OPENCLAW_STATE_DIR=~/.openclaw \
OPENCLAW_CONFIG_PATH=~/.openclaw/openclaw.json \
OPENCLAW_WORKSPACE_GLOB='~/.openclaw/workspace*' \
OPENCLAW_SOURCE_ROOT=~/openclaw \
corepack pnpm dev
```

Behavior:

- filesystem mode activates when any of `OPENCLAW_RUNTIME_ROOT`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_FILE`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_WORKSPACE_GLOB`, or `OPENCLAW_PROFILE` is set
- `OPENCLAW_CONFIG_FILE` / `OPENCLAW_CONFIG_PATH` are optional; when both are omitted, sidecar resolves the config path from the state dir using the same candidate order as OpenClaw
- `OPENCLAW_RUNTIME_ROOT` is a sidecar alias for `OPENCLAW_STATE_DIR`
- `OPENCLAW_CONFIG_FILE` is a sidecar alias for `OPENCLAW_CONFIG_PATH`
- `OPENCLAW_PROFILE` can derive the default state dir and default main-agent workspace even when no explicit paths are set
- missing paths do not switch back to mock mode; they surface as warnings and `partial` or `unavailable` collections
- `OPENCLAW_SOURCE_ROOT` is informational only and does not activate filesystem mode by itself

## Optional target registry mode

Use `SIDECAR_TARGETS_FILE` to register multiple targets in one console instance.

Example:

```bash
SIDECAR_TARGETS_FILE=./examples/targets.registry.example.json \
corepack pnpm dev
```

Target registry notes:

- each target can use either `mock` or `filesystem`
- all collection remains read-only
- target metadata flows through the existing `Target` and governance contracts

## Container startup

### Mock-first demo compose

The default compose path remains mock-first and does not mount an OpenClaw runtime directory automatically.

Start:

```bash
docker compose up --build
```

Stop:

```bash
docker compose down --remove-orphans
```

Follow logs:

```bash
docker compose logs -f
```

### Filesystem read-only compose

Use the filesystem compose when you want containerized startup against a real local OpenClaw state directory while keeping the whole stack read-only.

Prepare the env file:

```bash
cp .env.filesystem.example .env.filesystem
# update the placeholder host paths in .env.filesystem before starting
```

Start:

```bash
docker compose --env-file .env.filesystem -f docker-compose.filesystem.yml up --build
```

Stop:

```bash
docker compose -f docker-compose.filesystem.yml down --remove-orphans
```

Follow logs:

```bash
docker compose -f docker-compose.filesystem.yml logs -f
```

Filesystem compose notes:

- sidecar uses `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, and `OPENCLAW_PROFILE` as the primary container-side OpenClaw envs
- `OPENCLAW_WORKSPACE_GLOB` is kept as an optional override only
- host OpenClaw paths are bind-mounted read-only
- the existing three-service topology and healthcheck structure remain unchanged

## Healthchecks

Compose includes healthchecks for:

- sidecar: `GET /health`
- overlay-api: `GET /health`
- overlay-web: `GET /ready`

Filesystem compose config validation:

```bash
docker compose --env-file .env.filesystem.example -f docker-compose.filesystem.yml config
```

## Quality verification

```bash
corepack pnpm guard:readonly
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Safe reset

To clear generated artifacts without touching source files:

```bash
corepack pnpm dev:reset
```
