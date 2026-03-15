# Environment Setup

This repository now uses one main env template: [`.env.example`](../.env.example).

The goal is to keep first-time setup simple:

1. Copy `.env.example` to `.env`
2. Run `corepack pnpm dev`
3. If you want real OpenClaw data, replace only `OPENCLAW_STATE_DIR=/path/to/your/.openclaw`

## The simple rule

- Leave `/path/to/your/.openclaw` unchanged: the sidecar stays in `mock` mode
- Replace it with a real path such as `~/.openclaw`: the sidecar switches to read-only `filesystem` mode

That placeholder path is intentionally ignored by the sidecar so the default template stays safe for local mock-first startup.

## What `.env.example` contains

### Always useful

- `SIDECAR_PORT`
- `OVERLAY_API_PORT`
- `OVERLAY_WEB_PORT`
- `SIDECAR_MOCK_SCENARIO`
- `SIDECAR_TIMEOUT_MS`
- `OPENCLAW_STATE_DIR`

### Optional advanced settings

- `OPENCLAW_PROFILE`
- `OPENCLAW_GATEWAY_URL`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_SOURCE_ROOT`
- `SIDECAR_TARGET_ID`
- `SIDECAR_TARGET_NAME`
- `SIDECAR_TARGET_ENVIRONMENT`
- `SIDECAR_TARGET_OWNER`
- `SIDECAR_TARGETS_FILE`
- `VITE_OVERLAY_API_URL`
- `HOST_SIDECAR_PORT`
- `HOST_OVERLAY_API_PORT`
- `HOST_OVERLAY_WEB_PORT`

## What happens after you set `OPENCLAW_STATE_DIR`

When the filesystem adapter is active, the sidecar derives the rest by default:

- config file: `<stateDir>/openclaw.json` when present
- workspaces: `<stateDir>/workspace*`
- per-agent sessions: `<stateDir>/agents/<agentId>/sessions/sessions.json`
- legacy main-agent sessions fallback: `<stateDir>/sessions/sessions.json`

You do not need to set `OPENCLAW_CONFIG_PATH` or `OPENCLAW_WORKSPACE_GLOB` for the normal local layout.

## Docker Compose

`docker-compose.filesystem.yml` also reads the same `OPENCLAW_STATE_DIR` from `.env`.

Typical flow:

```bash
cp .env.example .env
# replace OPENCLAW_STATE_DIR with your real local OpenClaw path
docker compose -f docker-compose.filesystem.yml up --build
```

Compose-only host port overrides still live in the same `.env` file:

- `HOST_SIDECAR_PORT`
- `HOST_OVERLAY_API_PORT`
- `HOST_OVERLAY_WEB_PORT`

## Browser variable

Keep `VITE_OVERLAY_API_URL` empty by default so the browser uses the web server's same-origin `/api` proxy instead of calling `4300` directly.

## Multi-target mode

Use `SIDECAR_TARGETS_FILE` only when you want the console to load multiple targets from a registry file.

If you are just evaluating one local runtime, you can ignore it.
