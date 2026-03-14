# Release Alpha

## Release identity

- product: OpenClaw Team Ops Console
- descriptor: Read-only governance and visibility for OpenClaw runtimes
- phase: v0.2 governance preview
- status: internal evaluation package
- mode: standalone, read-only, mock-first

## Scope included

- standalone monorepo with sidecar + overlay-api + overlay-web
- target registry with single-target and multi-target modes
- mock-backed and filesystem-backed read-only collection
- governance endpoints for targets, evidence, findings, recommendations, and risks summary
- inventory-first and governance-first UI
- containerized local startup path
- mock-first demo compose plus filesystem-backed read-only compose
- CI quality gates for install, read-only guard, typecheck, test, and build

## Scope explicitly excluded

- write endpoints or control actions
- real OpenClaw core integration through private modules
- auth/RBAC rollout
- chat UX
- config mutation
- remote execution
- agent/session termination

## Internal reviewer acceptance checklist

- [ ] repository starts locally with `corepack pnpm dev`
- [ ] repository starts with `docker compose up --build`
- [ ] filesystem compose renders with `docker compose --env-file .env.filesystem.example -f docker-compose.filesystem.yml config`
- [ ] default startup uses mock mode without extra setup
- [ ] `Overview`, `Targets`, `Risks`, `Findings`, and `Evidence` load successfully
- [ ] inventory pages still load successfully
- [ ] no write controls or mutation actions are present in the UI
- [ ] API remains GET-only
- [ ] degraded mock and filesystem scenarios remain readable
- [ ] `corepack pnpm check` passes

## Suggested demo flow

1. Start with `baseline`
2. Capture `Overview` and `Targets`
3. Review `Risks` and `Findings`
4. Open one `Finding Detail`
5. Review linked `Evidence Detail`
6. Restart with `partial-coverage`
7. Confirm degraded states and recommendations remain readable
8. Restart with `stale-observability`
9. Confirm freshness and stale-target messaging remain readable

## Known limitations

- no write-back or control plane actions
- filesystem is the only real adapter today
- only one minimal browser-level E2E is in place today
- screenshots and review artifacts still need to be captured per environment
