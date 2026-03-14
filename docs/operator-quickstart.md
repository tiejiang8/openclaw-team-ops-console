# Operator Quickstart

This quickstart is for internal evaluators who want to run the alpha package quickly and verify the current read-only scope.

## What You Are Starting

- standalone sidecar product
- read-only operations console
- mock-backed by default
- no OpenClaw core modifications required

## Fastest Local Path

1. Install dependencies

```bash
corepack pnpm install
```

2. Copy env defaults if desired

```bash
cp .env.example .env
```

3. Start the stack

```bash
corepack pnpm dev
```

4. Open the console

- `http://localhost:5173`

## Fastest Container Path

```bash
docker compose up --build
```

Then open:

- `http://localhost:5173`

## Recommended Reviewer Path

1. Verify Overview loads and shows summary cards
2. Review `Agents`, `Workspaces`, `Sessions`, `Bindings`, `Auth Profiles`, and `Topology`
3. Confirm no write controls are present
4. Switch to `partial-coverage` or `stale-observability` and confirm degraded states remain readable

## Useful Commands

Validation:

```bash
corepack pnpm check
```

Safe reset of generated artifacts:

```bash
corepack pnpm dev:reset
```

Container logs:

```bash
docker compose logs -f
```

## Mock Scenario Examples

```bash
SIDECAR_MOCK_SCENARIO=baseline corepack pnpm dev
SIDECAR_MOCK_SCENARIO=partial-coverage corepack pnpm dev
SIDECAR_MOCK_SCENARIO=stale-observability corepack pnpm dev
```

## Read-only Reminder

This alpha does not implement:

- create, update, delete, restart, terminate, or apply actions
- real OpenClaw adapter logic
- auth or RBAC flows
- chat, prompt editing, or execution control surfaces
