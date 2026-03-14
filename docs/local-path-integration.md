# Local Path Integration

This document describes the Phase 1.4 read-only filesystem adapter for local OpenClaw runtime inspection.

## Boundary

- standalone sidecar product
- no OpenClaw source imports
- no patching, forking, or vendoring
- no write-back
- mock remains the default when local runtime paths are unset

## Activation Rule

The sidecar switches from mock mode to filesystem mode when any of these are set:

- `OPENCLAW_RUNTIME_ROOT`
- `OPENCLAW_STATE_DIR`
- `OPENCLAW_CONFIG_FILE`
- `OPENCLAW_CONFIG_PATH`
- `OPENCLAW_WORKSPACE_GLOB`
- `OPENCLAW_PROFILE`

`OPENCLAW_SOURCE_ROOT` is informational only. It does not activate the filesystem adapter by itself.

## Environment Variables

### `OPENCLAW_RUNTIME_ROOT`

Product-specific alias for the OpenClaw state dir.

### `OPENCLAW_STATE_DIR`

Expected value:

- OpenClaw state/runtime root such as `~/.openclaw`

Used for:

- default config path fallback
- per-agent session stores
- legacy single-agent session-store fallback
- per-agent auth profile files

Resolution notes:

- `OPENCLAW_RUNTIME_ROOT` wins over `OPENCLAW_STATE_DIR`
- when neither is set, the sidecar derives the state dir from `OPENCLAW_PROFILE`
- non-default profiles fall back to `~/.openclaw-<profile>`
- otherwise the default is `~/.openclaw`

### `OPENCLAW_CONFIG_FILE`

Product-specific alias for the canonical config path.

### `OPENCLAW_CONFIG_PATH`

Expected value:

- explicit config file path such as `~/.openclaw/openclaw.json`

Behavior:

- parsed as JSON5
- supports `$include`
- resolution order is:
  - `OPENCLAW_CONFIG_FILE`
  - `OPENCLAW_CONFIG_PATH`
  - existing config candidate under the resolved state dir
  - canonical `<stateDir>/openclaw.json`
- existing config candidates currently include:
  - `openclaw.json`
  - `clawdbot.json`
  - `moldbot.json`
  - `moltbot.json`

### `OPENCLAW_WORKSPACE_GLOB`

Expected value:

- workspace directory glob such as `~/.openclaw/workspace*`

Behavior:

- scanned read-only
- directories only
- relative patterns resolve from the resolved state dir when it is set, otherwise from the current working directory
- when unset, the sidecar uses the official default glob `~/.openclaw/workspace*`

### `OPENCLAW_PROFILE`

Expected value:

- OpenClaw profile name such as `default`, `dev`, or `prod`

Behavior:

- can activate filesystem mode by itself
- contributes to default state-dir resolution
- contributes to default workspace resolution for the main/default agent:
  - `~/.openclaw/workspace` for `default`
  - `~/.openclaw/workspace-<profile>` for non-default profiles

### `OPENCLAW_SOURCE_ROOT`

Expected value:

- optional local checkout path such as `~/openclaw`

Behavior:

- informational only
- exposed through runtime metadata
- never imported or executed

## Supported Files And Paths

Confirmed read-only paths currently used:

- `${OPENCLAW_CONFIG_FILE}`
- `${OPENCLAW_CONFIG_PATH}`
- `<stateDir>/openclaw.json`
- `<stateDir>/clawdbot.json`
- `<stateDir>/moldbot.json`
- `<stateDir>/moltbot.json`
- `<stateDir>/agents/<agentId>/agent/auth-profiles.json`
- `session.store` when configured in config
- `<stateDir>/agents/<agentId>/sessions/sessions.json`
- `<stateDir>/sessions/sessions.json` for the documented legacy single-agent fallback
- workspace paths from config:
  - `agents.defaults.workspace`
  - `agents.list[].workspace`
- runtime-only or implicit fallback workspaces:
  - `~/.openclaw/workspace`
  - `~/.openclaw/workspace-<profile>`
  - `~/.openclaw/workspace-<agentId>`
- workspace directories from `OPENCLAW_WORKSPACE_GLOB`

Workspace inventory checks for common bootstrap and inventory files:

- `AGENTS.md`
- `BOOT.md`
- `SOUL.md`
- `TOOLS.md`
- `BOOTSTRAP.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `MEMORY.md`
- `memory.md`
- `memory/`
- `skills/`

## Normalized Output

The filesystem adapter feeds the existing sidecar and overlay-api contracts:

- agents from config and runtime directory discovery
- workspaces from config and directory scans
- bindings from config
- auth profile inventory from `auth-profiles.json` without exposing secrets
- session inventory from `session.store`, default per-agent stores, and the documented legacy single-agent store fallback
- runtime status entries for config, runtime root, workspace scan, session scan, auth scan, and optional source root

## Degraded Behavior

When files or directories are missing:

- sidecar stays in filesystem mode
- collections are marked `partial` or `unavailable`
- warnings are attached to snapshot metadata
- health degrades instead of failing closed

This makes missing runtime paths visible to operators without silently falling back to mock data.

## Example

```bash
OPENCLAW_STATE_DIR=~/.openclaw \
OPENCLAW_CONFIG_PATH=~/.openclaw/openclaw.json \
OPENCLAW_WORKSPACE_GLOB='~/.openclaw/workspace*' \
OPENCLAW_SOURCE_ROOT=~/openclaw \
corepack pnpm dev
```

Optional explicit config path:

```bash
OPENCLAW_PROFILE=dev \
OPENCLAW_STATE_DIR=~/.openclaw-dev \
OPENCLAW_CONFIG_PATH=~/.openclaw-dev/openclaw.json \
OPENCLAW_WORKSPACE_GLOB='~/.openclaw/workspace*' \
corepack pnpm dev
```

## Containerized Read-only Path

The repository also provides a filesystem-backed compose path for real OpenClaw read-only evaluation:

```bash
cp .env.filesystem.example .env.filesystem
docker compose --env-file .env.filesystem -f docker-compose.filesystem.yml up --build
```

Container notes:

- the sidecar container uses `OPENCLAW_STATE_DIR=/openclaw-state`
- `OPENCLAW_CONFIG_PATH` defaults to `/openclaw-state/openclaw.json`
- `OPENCLAW_PROFILE` stays optional
- `OPENCLAW_WORKSPACE_GLOB` is optional and defaults to `/openclaw-state/workspace*`
- host state and workspace paths are bind-mounted read-only
