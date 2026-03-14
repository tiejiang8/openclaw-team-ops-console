# External Data Sources

This document separates confirmed external read-only sources from future options and excluded paths.

Phase 1.4 implements the local filesystem/runtime source path described below. Mock mode still remains the default unless local runtime paths are configured.

## Confirmed External Read-only Sources

These sources are documented in the sibling OpenClaw repo and are confirmed external surfaces for this console. Some are already implemented today; others are confirmed and implementation-ready but not wired yet.

### CLI diagnostics and status

- `openclaw status --all`
- `openclaw status --deep`
- `openclaw gateway status --json`
- `openclaw health --json`
- `openclaw channels status --probe`

Implementation status:

- confirmed external surfaces
- adapter implementation still pending in this repo

Why these matter:

- they are explicitly user-facing interfaces
- they are already intended for diagnosis and health inspection
- they align with a read-only ops-console posture

### Read-only gateway call surfaces

- `openclaw gateway call status`
- `openclaw gateway call health`
- `openclaw gateway call sessions.list --params '{}'`
- `openclaw gateway call <method>` with an allowlisted read-only method set only

Implementation status:

- confirmed external CLI/RPC bridge
- adapter implementation still pending in this repo

Why these matter:

- they provide structured, scriptable access without importing OpenClaw modules
- `sessions.list` is directly relevant for session inventory and cross-checking session-store coverage
- the CLI surface itself is documented and stable enough to treat as an external contract

Important boundary:

- this repo must only consume allowlisted read-only gateway-call methods
- mutating methods such as config apply/patch remain out of scope

### Gateway health endpoints

- `/healthz`
- `/health`
- `/ready`

Why these matter:

- they are externally reachable health surfaces
- they support runtime availability and dependency posture checks without write access

### Filesystem state on the gateway host

Current repo status:

- implemented as the read-only `FilesystemOpenClawAdapter`
- activated only when local runtime path env vars are configured
- still isolated behind sidecar adapter contracts

Documented paths include:

- `~/.openclaw/openclaw.json`
- `~/.openclaw/credentials/`
- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- `~/.openclaw/agents/<agentId>/sessions/*.jsonl`
- `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`

Why these matter:

- they provide concrete inventory and session metadata sources
- they can be read without importing OpenClaw code
- they support a standalone sidecar model
- they degrade cleanly when paths or files are missing

## Confirmed But Excluded

These exist externally but are not appropriate adapter sources for this product phase.

### `openclaw doctor`

Reason for exclusion:

- it is a repair and migration tool
- it can prompt, fix, or rewrite state
- it violates the strict read-only boundary for this console

## Future Options and Assumptions

These may become valid later, but they are not confirmed enough for implementation beyond the current filesystem adapter and the confirmed CLI/health surfaces listed above.

### Remote gateway websocket access

Known surface:

- `ws://127.0.0.1:18789`
- remote `wss://...` patterns documented for gateway access

Why still considered future work:

- health snapshots are documented, but stable inventory-oriented contracts are not yet committed here
- auth, remote reachability, and schema guarantees need clearer validation first

### Additional gateway HTTP or RPC inventory endpoints

Potentially useful for:

- richer binding inventory
- auth profile coverage
- live route or session relationships

Why still considered future work:

- this repo should not depend on undocumented or unstable RPC shapes
- a real adapter should only consume interfaces we can treat as stable external contracts

## Risks and Limitations

- filesystem schema can drift across OpenClaw versions
- state directories contain sensitive credentials and must be redacted carefully
- CLI probes may be slow or require local binaries and auth context
- remote gateway surfaces can be unreachable or auth-gated
- some fields may remain unavailable, which is why this repo now models partial and stale collections explicitly
