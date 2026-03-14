# Integration Boundaries

## Boundary Statement

OpenClaw Team Ops Console is an **external sidecar product**. It integrates with OpenClaw as an external system and does not require or assume modifications in OpenClaw core.

## Hard Rules for v0.1

- Do not modify OpenClaw source code.
- Do not patch/fork/vendor OpenClaw core.
- Do not depend on OpenClaw dashboard/gateway UI changes.
- Do not inject code into OpenClaw runtime.
- Do not monkey patch OpenClaw internals.
- Keep all operations read-only.

## Allowed Integration Pattern

- sidecar adapters connect only to externally exposed sources
- adapters are swappable behind `SidecarInventoryAdapter`
- overlay-api consumes sidecar outputs and normalizes contracts
- overlay-web consumes only overlay-api contracts
- degraded or partial external reads must surface via collection metadata and warnings, not hidden assumptions

## Non-goals for v0.1

- agent creation/deletion
- session termination
- configuration mutation
- auth mutation
- embedded chat/control surfaces
- write-back RPC paths

## Extension Guidance

When integrating real OpenClaw sources later:

1. add a new adapter implementation in `apps/sidecar/src/adapters`
2. keep adapter output compliant with `packages/shared` domain contracts
3. preserve overlay-api endpoint stability
4. avoid introducing coupling to OpenClaw internal codepaths
5. use only confirmed external read-only surfaces documented in `docs/external-data-sources.md`

Confirmed examples now include:

- `openclaw gateway status --json`
- `openclaw health --json`
- allowlisted read-only `openclaw gateway call ...` methods such as `status`, `health`, and `sessions.list`

## Explicit Exclusions

- `openclaw doctor` is not a valid adapter source because it can repair or mutate state.
- Any gateway/UI/API surface that is not externally documented or clearly stable should remain a future option only.

## Security and Compliance Posture (v0.1)

- read-only by design
- no credential mutation endpoints
- explicit source metadata in responses (`meta.source`)
- health endpoints expose dependency status without privileged actions
