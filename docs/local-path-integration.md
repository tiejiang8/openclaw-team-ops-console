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
- `OPENCLAW_CONFIG_FILE`
- `OPENCLAW_WORKSPACE_GLOB`

`OPENCLAW_SOURCE_ROOT` is informational only. It does not activate the filesystem adapter by itself.

## Environment Variables

### `OPENCLAW_RUNTIME_ROOT`

Expected value:

- OpenClaw state/runtime root such as `~/.openclaw`

Used for:

- default config path fallback
- per-agent session stores
- per-agent auth profile files

### `OPENCLAW_CONFIG_FILE`

Expected value:

- explicit config file path such as `~/.openclaw/openclaw.json`

Behavior:

- parsed as JSON5
- supports `$include`
- when unset and `OPENCLAW_RUNTIME_ROOT` is set, sidecar reads `${OPENCLAW_RUNTIME_ROOT}/openclaw.json`

### `OPENCLAW_WORKSPACE_GLOB`

Expected value:

- workspace directory glob such as `~/.openclaw/workspace*`

Behavior:

- scanned read-only
- directories only
- relative patterns resolve from `OPENCLAW_RUNTIME_ROOT` when it is set, otherwise from the current working directory

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
- `${OPENCLAW_RUNTIME_ROOT}/openclaw.json`
- `${OPENCLAW_RUNTIME_ROOT}/agents/<agentId>/agent/auth-profiles.json`
- `${OPENCLAW_RUNTIME_ROOT}/agents/<agentId>/sessions/sessions.json`
- workspace paths from config:
  - `agents.defaults.workspace`
  - `agents.list[].workspace`
- workspace directories from `OPENCLAW_WORKSPACE_GLOB`

Workspace inventory checks for common bootstrap and inventory files:

- `AGENTS.md`
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
- session inventory from `sessions.json`
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
OPENCLAW_RUNTIME_ROOT=~/.openclaw \
OPENCLAW_WORKSPACE_GLOB='~/.openclaw/workspace*' \
OPENCLAW_SOURCE_ROOT=~/openclaw \
corepack pnpm dev
```

Optional explicit config path:

```bash
OPENCLAW_RUNTIME_ROOT=~/.openclaw-main \
OPENCLAW_CONFIG_FILE=~/.openclaw-main/openclaw.json \
OPENCLAW_WORKSPACE_GLOB='~/.openclaw-main/workspace*' \
corepack pnpm dev
```
