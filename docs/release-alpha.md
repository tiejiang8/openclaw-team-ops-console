# Release Alpha

## Release Identity

- product: OpenClaw Team Ops Console
- descriptor: OpenClaw Multi-Agent Control
- phase: v0.1 alpha
- status: internal evaluation package
- mode: standalone, read-only, mock-first

## Scope Included

- standalone monorepo with sidecar + overlay-api + overlay-web
- mock-backed inventory and topology
- read-only REST API
- inventory-first admin UI
- containerized local startup path
- CI quality gates for install, read-only guard, typecheck, test, and build

## Scope Explicitly Excluded

- real OpenClaw adapter implementation
- write endpoints or control actions
- auth/RBAC rollout
- chat UX
- config mutation
- agent/session termination or execution control

## Internal Reviewer Acceptance Checklist

- [ ] repository starts locally with `corepack pnpm dev`
- [ ] repository starts with `docker compose up --build`
- [ ] default startup uses mock mode without extra setup
- [ ] Overview, Agents, Workspaces, Sessions, Bindings, Auth Profiles, and Topology load successfully
- [ ] no write controls or mutation actions are present in the UI
- [ ] API remains GET-only
- [ ] degraded mock scenarios remain readable
- [ ] `corepack pnpm check` passes

## Suggested Demo Flow

1. Start with `baseline`
2. Capture `Overview`
3. Review `Agents` and `Sessions`
4. Review `Topology`
5. Restart with `partial-coverage`
6. Confirm empty or partial fields render safely
7. Restart with `stale-observability`
8. Confirm stale status messaging remains readable

## Screenshot Instructions

Suggested screenshots for internal review:

- Overview dashboard with summary cards and runtime table
- Agents inventory table
- Sessions inventory table
- Topology relationships page

Recommended setup:

- scenario: `baseline`
- browser width: desktop
- capture without browser devtools open
- keep the left navigation visible

## Known Limitations

- mock data is still the default backing source
- no real OpenClaw adapter is shipped in this alpha
- no auth or tenant isolation implementation
- no real-time streaming layer
- topology remains table-based and intentionally lightweight
- external source plan is documented, but actual integration is deferred

## Release Readiness Notes

This alpha is suitable for:

- internal UX review
- inventory model review
- integration-boundary review
- local operator experience review

This alpha is not yet suitable for:

- production deployment
- privileged operational control
- real OpenClaw data collection in customer environments
