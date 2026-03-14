# Real Adapter Plan

## Phase 1.4 Status

The repo now includes one real OpenClaw adapter path:

- `FilesystemOpenClawAdapter`
- reads documented local runtime/config/workspace files only
- stays strictly read-only
- does not import or execute OpenClaw source modules

Mock mode remains the default working mode.

## Adapter Strategy

Future adapters must remain behind `SidecarInventoryAdapter` and preserve these rules:

- treat OpenClaw as an external system
- use externally exposed read-only sources only
- emit `SystemSnapshot` plus collection metadata and warnings
- tolerate partial, stale, or unavailable collections
- avoid any write path, repair path, or control path

## Recommended Adapter Layers

### 1. Filesystem adapter

Current status: implemented for local path-based integration.

Use read-only inspection of the OpenClaw state directory for inventory that clearly exists on disk.

Good fit for:

- workspace inventory from config/state files
- session metadata from per-agent session stores
- session transcript presence and timestamps
- auth profile inventory where files are explicitly part of managed state

Constraints:

- must redact or avoid sensitive credential payloads
- must treat path layout as version-sensitive
- should mark collections `partial` when schema or files are missing
- should only activate when operators explicitly configure local runtime paths

### 2. CLI status adapter

Current status: future work.

Spawn documented read-only CLI commands and normalize their output.

Best candidates:

- `openclaw status --all`
- `openclaw status --deep`
- `openclaw gateway status --json`
- `openclaw health --json`
- `openclaw channels status --probe`

Constraints:

- depends on CLI availability on the host
- machine-readable output is preferred; text parsing should be a fallback only
- probe timeouts and auth failures must surface as degraded metadata, not crashes

### 3. Gateway health adapter

Current status: future work.

Use documented gateway health endpoints for runtime and dependency posture.

Best candidates:

- `/healthz`
- `/health`
- `/ready`

Constraints:

- health endpoints alone do not provide full inventory
- any richer RPC or remote endpoint must be explicitly documented and externally supported before use

## Explicitly Excluded

These are not acceptable adapter paths for Phase 1.x:

- OpenClaw source imports
- vendored/copied core modules
- monkey patching or runtime injection
- write-capable CLI flows
- repair tools such as `openclaw doctor`
- assumptions that require OpenClaw dashboard or gateway UI changes

## Contract Expectations

Real adapters should populate:

- `origin.sources` with confirmed or assumed source descriptors
- `collections.*.status`
- `collections.*.freshness`
- `collections.*.collectedAt`
- `collections.*.warnings`
- snapshot-wide `warnings` for cross-collection degradation

## Fallback Behavior

Recommended precedence:

1. `baseline` mock mode by default
2. filesystem adapter when `OPENCLAW_RUNTIME_ROOT`, `OPENCLAW_CONFIG_FILE`, or `OPENCLAW_WORKSPACE_GLOB` is configured
3. per-collection downgrade to `partial` or `unavailable` when a source fails
4. preserve last known normalized snapshot only when staleness is clearly surfaced

## Open Questions Before Real Integration

- Which OpenClaw inventory surfaces are stable and documented enough to depend on?
- Which fields can be collected safely without exposing secrets?
- Which inventories should come from filesystem state versus CLI versus gateway health?
- How should profiles or remote gateway targets be configured without adding auth mutation to this repo?
