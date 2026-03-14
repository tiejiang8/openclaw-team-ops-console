# Operator Quickstart

This quickstart is for internal evaluators who want to run the governance preview quickly and verify the current read-only scope.

## What you are starting

- standalone sidecar product
- read-only governance and visibility console
- mock-backed by default
- optional local filesystem adapter
- optional multi-target registry

## Fastest local path

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

## Fastest container path

```bash
docker compose up --build
```

Then open:

- `http://localhost:5173`

## Recommended reviewer path

1. Verify `Overview` loads and shows fleet-level cards
2. Open `Targets` and confirm target metadata and coverage
3. Open `Risks` and drill into a finding
4. From `Finding Detail`, open evidence and recommendations
5. From `Evidence Detail`, jump to the related resource
6. Confirm no write controls are present anywhere

## Useful commands

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

## Mock scenario examples

```bash
SIDECAR_MOCK_SCENARIO=baseline corepack pnpm dev
SIDECAR_MOCK_SCENARIO=partial-coverage corepack pnpm dev
SIDECAR_MOCK_SCENARIO=stale-observability corepack pnpm dev
SIDECAR_MOCK_SCENARIO=error-upstream corepack pnpm dev
```

## Read-only reminder

This preview does not implement:

- create, update, delete, restart, terminate, or apply actions
- remote execution
- auth or RBAC flows
- chat, prompt editing, or execution control surfaces
