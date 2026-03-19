# Read-only Guarantees

OpenClaw Team Ops Console is built with a "Privacy and Safety First" architecture. We guarantee that the console will never modify your OpenClaw runtime state.

## 1. No Write Endpoints
The `overlay-api` only exposes `GET` endpoints. There are no `POST`, `PUT`, `PATCH`, or `DELETE` routes for operational data.
- **Verification**: Run `pnpm guard:readonly` to scan the codebase for prohibited HTTP methods.

## 2. Read-only Filesystem Access
The `sidecar` adapter uses read-only filesystem calls (`fs.readFileSync`, `fs.readdirSync`). It never uses `fs.writeFileSync`, `fs.mkdirSync`, or any other destructive operations.
- **Verification**: The sidecar does not even request write permissions when running in Docker (see `docker-compose.filesystem.yml` with `:ro` mounts).

## 3. Sandboxed Sidecar
The `sidecar` acts as a security barrier. It translates raw filesystem and Gateway data into an immutable snapshot. The `overlay-api` and `overlay-web` never interact with your files directly.

## 4. Limited Gateway Scope
When connecting to an OpenClaw Gateway via WebSocket, the console only uses the `operator.read` capability. It only requests:
- `node.list`
- `cron.status`
- `system.presence`
It never sends execution or binding commands.

## 5. Mock-First Development
We encourage using mock data for development and testing. This ensures that the UI and API logic are fully decoupled from real production data, preventing accidental leaks or interactions during development.

## 6. Strict Quality Gates
Every Pull Request must pass the `guard:readonly` check, which ensures no write-based logic has been introduced into the controller or service layers.
