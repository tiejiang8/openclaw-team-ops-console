# OpenClaw Team Ops Console

**OpenClaw Multi-Agent Control**

## 中文说明

OpenClaw Team Ops Console 是一个 **v0.1 alpha**、**独立运行**、**严格只读**、**默认 mock-first** 的运维可视化控制台，用于从外部观察 OpenClaw 的多 Agent 运行状态、工作区、会话、绑定关系与运行拓扑。

本仓库始终保持以下边界：

- 不修改 OpenClaw core
- 不 import OpenClaw 源码模块
- 不 patch / fork / vendor OpenClaw
- 不提供写回、控制、终止、编辑、创建等操作
- 不做 chat UX
- 保持 `sidecar + overlay-api + overlay-web` 架构

### 当前代码已经实现什么

#### 1. `apps/sidecar`

只读数据采集层，当前支持两种 adapter 模式：

- `mock`
  - 默认模式
  - 支持 `baseline`、`partial-coverage`、`stale-observability`、`error-upstream`
- `filesystem`
  - Phase 1.4 新增
  - 通过本地文件系统只读扫描 OpenClaw 运行目录
  - 读取配置、工作区、session store、auth profile 等信息
  - 缺失文件时降级输出 warning 和 `partial/unavailable`，不会写回

当前 sidecar 还会：

- 输出统一 `SystemSnapshot`
- 输出 collection metadata、freshness、warnings
- 提供只读 sidecar 路由
- `x-openclaw-ops-readonly: true`

#### 2. `apps/overlay-api`

只读聚合 API，负责：

- 从 sidecar 读取快照
- 暴露稳定 REST 接口
- 增加 overlay-api 自身 runtime status
- 保持 GET-only

当前接口：

- `GET /health`
- `GET /api/summary`
- `GET /api/agents`
- `GET /api/agents/:id`
- `GET /api/workspaces`
- `GET /api/sessions`
- `GET /api/bindings`
- `GET /api/auth-profiles`
- `GET /api/topology`
- `GET /api/runtime-status`

#### 3. `apps/overlay-web`

独立只读运维界面，当前页面包括：

- `Overview`
- `Agents`
- `Workspaces`
- `Sessions`
- `Bindings`
- `Auth Profiles`
- `Topology`

当前 UI 已具备：

- 表格排序
- 客户端分页
- 搜索 / 过滤
- URL 状态持久化
- loading / empty / error / retry 状态
- comfortable / compact 密度切换

#### 4. `packages/shared`

共享域模型、DTO 和 builders，统一 sidecar / overlay-api / overlay-web 三层契约。

### Phase 1.4 文件系统只读 adapter 当前能力

当前 `filesystem` adapter 已实现：

- 读取 `OPENCLAW_CONFIG_FILE`，按 JSON5 解析
- 支持配置文件 `$include`
- 从配置中解析：
  - `agents.defaults.workspace`
  - `agents.list[].workspace`
  - `agents.list[].id`
  - `agents.list[].name`
  - `agents.list[].agentDir`
  - `bindings`
- 扫描 `OPENCLAW_WORKSPACE_GLOB`
- 读取：
  - `${OPENCLAW_RUNTIME_ROOT}/openclaw.json`
  - `${OPENCLAW_RUNTIME_ROOT}/agents/<agentId>/agent/auth-profiles.json`
  - `${OPENCLAW_RUNTIME_ROOT}/agents/<agentId>/sessions/sessions.json`
- 工作区内会识别常见文件：
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

### 当前 adapter 切换规则

代码当前并 **没有** 使用 `SIDECAR_SOURCE` 作为实际开关。

当前真实生效的规则是：

- 如果没有设置以下任一变量，则使用 `mock`
  - `OPENCLAW_RUNTIME_ROOT`
  - `OPENCLAW_CONFIG_FILE`
  - `OPENCLAW_WORKSPACE_GLOB`
- 只要设置了以上任一变量，就会启用 `filesystem` adapter
- `OPENCLAW_SOURCE_ROOT` 仅用于展示 source metadata，不单独触发 adapter 切换

### 你提供的 `.env` 参考，与当前代码对照

#### 当前代码已经实际读取的变量

- `SIDECAR_PORT`
- `OVERLAY_API_PORT`
- `VITE_OVERLAY_API_URL`
- `SIDECAR_MOCK_SCENARIO`
- `OPENCLAW_RUNTIME_ROOT`
- `OPENCLAW_CONFIG_FILE`
- `OPENCLAW_WORKSPACE_GLOB`
- `OPENCLAW_SOURCE_ROOT`

#### 当前代码中尚未接线、仅可视为预留的变量

- `SIDECAR_SOURCE`
- `OPENCLAW_GATEWAY_URL`
- `OPENCLAW_DASHBOARD_URL`
- `OPENCLAW_LOG_GLOB`

也就是说，你这份 `.env` 可以作为本地参考，但上面 4 个“预留变量”当前不会改变运行行为。

### 推荐 `.env` 示例

```env
SIDECAR_PORT=4310
OVERLAY_API_PORT=4300
VITE_OVERLAY_API_URL=http://localhost:4300

# 默认仍可保留 mock
SIDECAR_MOCK_SCENARIO=baseline

# Phase 1.4 本地只读 filesystem adapter
OPENCLAW_RUNTIME_ROOT=/home/zhangsy/.openclaw
OPENCLAW_CONFIG_FILE=/home/zhangsy/.openclaw/openclaw.json
OPENCLAW_WORKSPACE_GLOB=/home/zhangsy/.openclaw/workspace*
OPENCLAW_SOURCE_ROOT=/home/zhangsy/code/openclaw
```

### 其他当前已支持的运行变量

- `SIDECAR_BASE_URL`
  - overlay-api 访问 sidecar 的上游地址
  - 默认：`http://localhost:4310`
- `SIDECAR_TIMEOUT_MS`
  - overlay-api 请求 sidecar 的超时时间
  - 默认：`5000`
- `OVERLAY_WEB_PORT`
  - 本地开发时 overlay-web 端口
  - 默认：`5173`
- `OVERLAY_API_PROXY_TARGET`
  - Vite 开发代理目标
  - 默认：`http://localhost:4300`
- `HOST_SIDECAR_PORT`
- `HOST_OVERLAY_API_PORT`
- `HOST_OVERLAY_WEB_PORT`
  - 以上 3 个主要用于 Docker Compose 对外暴露端口

说明：

- 如果不设置 `VITE_OVERLAY_API_URL`，前端默认走同源 `/api` 与 `/health`
- 如果设置为 `http://localhost:4300`，前端会直接请求 overlay-api

### 本地启动

#### 默认 mock 模式

```bash
corepack pnpm install
corepack pnpm dev
```

#### 本地 OpenClaw 文件系统只读模式

```bash
OPENCLAW_RUNTIME_ROOT=/home/zhangsy/.openclaw \
OPENCLAW_CONFIG_FILE=/home/zhangsy/.openclaw/openclaw.json \
OPENCLAW_WORKSPACE_GLOB='/home/zhangsy/.openclaw/workspace*' \
OPENCLAW_SOURCE_ROOT=/home/zhangsy/code/openclaw \
corepack pnpm dev
```

本地地址：

- Overlay Web: `http://localhost:5173`
- Overlay API: `http://localhost:4300`
- Sidecar: `http://localhost:4310`

### Docker 启动

```bash
docker compose up --build
```

说明：

- 当前 compose 默认仍是 mock-first
- 没有默认挂载本地 OpenClaw runtime 目录
- 如果要走本地 filesystem adapter，当前更适合 process mode

### 质量检查

```bash
corepack pnpm guard:readonly
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm check
```

### 当前版本限制

- 仍然是 v0.1 alpha
- 仍然严格只读
- 默认仍然是 mock-first
- 真实 adapter 目前只有本地 filesystem adapter
- 还没有接入真实 gateway HTTP / dashboard / log / CLI adapter
- 没有 RBAC
- 没有实时事件总线
- 没有 chat、prompt 编辑、执行控制、写回功能

---

## English

OpenClaw Team Ops Console is a **v0.1 alpha**, **standalone**, **strictly read-only**, **mock-first by default** operations console for external visibility into OpenClaw multi-agent environments.

The repository keeps a hard external-system boundary:

- no OpenClaw core changes
- no OpenClaw source imports
- no patch / fork / vendor
- no write-back or control actions
- no chat UX
- architecture remains `sidecar + overlay-api + overlay-web`

### What the code currently implements

#### 1. `apps/sidecar`

Read-only source collection layer with two adapter modes:

- `mock`
  - default mode
  - supports `baseline`, `partial-coverage`, `stale-observability`, `error-upstream`
- `filesystem`
  - added in Phase 1.4
  - reads local OpenClaw runtime paths from the filesystem in read-only mode
  - collects config, workspaces, sessions, auth profiles, and runtime summary data
  - degrades with warnings and `partial/unavailable` metadata when files are missing

The sidecar currently:

- emits normalized `SystemSnapshot`
- includes collection metadata, freshness, and warnings
- exposes read-only sidecar routes
- sets `x-openclaw-ops-readonly: true`

#### 2. `apps/overlay-api`

Read-only aggregation API that:

- reads snapshots from sidecar
- exposes stable REST endpoints
- appends overlay-api runtime status
- remains GET-only

Current endpoints:

- `GET /health`
- `GET /api/summary`
- `GET /api/agents`
- `GET /api/agents/:id`
- `GET /api/workspaces`
- `GET /api/sessions`
- `GET /api/bindings`
- `GET /api/auth-profiles`
- `GET /api/topology`
- `GET /api/runtime-status`

#### 3. `apps/overlay-web`

Standalone read-only ops UI with these routes:

- `Overview`
- `Agents`
- `Workspaces`
- `Sessions`
- `Bindings`
- `Auth Profiles`
- `Topology`

Current UX capabilities:

- table sorting
- client-side pagination
- search / filtering
- URL-persisted state
- loading / empty / error / retry states
- comfortable / compact density modes

#### 4. `packages/shared`

Shared domain models, DTOs, and builders used consistently across sidecar, overlay-api, and overlay-web.

### Current Phase 1.4 filesystem adapter capabilities

The current `filesystem` adapter already supports:

- reading `OPENCLAW_CONFIG_FILE` as JSON5
- supporting config `$include`
- parsing config fields such as:
  - `agents.defaults.workspace`
  - `agents.list[].workspace`
  - `agents.list[].id`
  - `agents.list[].name`
  - `agents.list[].agentDir`
  - `bindings`
- scanning `OPENCLAW_WORKSPACE_GLOB`
- reading:
  - `${OPENCLAW_RUNTIME_ROOT}/openclaw.json`
  - `${OPENCLAW_RUNTIME_ROOT}/agents/<agentId>/agent/auth-profiles.json`
  - `${OPENCLAW_RUNTIME_ROOT}/agents/<agentId>/sessions/sessions.json`
- checking common workspace files:
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

### Actual adapter selection behavior

The current code does **not** use `SIDECAR_SOURCE` as a live switch.

The real behavior today is:

- if none of these are set, sidecar stays in `mock` mode:
  - `OPENCLAW_RUNTIME_ROOT`
  - `OPENCLAW_CONFIG_FILE`
  - `OPENCLAW_WORKSPACE_GLOB`
- if any of them is set, sidecar switches to the `filesystem` adapter
- `OPENCLAW_SOURCE_ROOT` is informational only and does not activate filesystem mode by itself

### Your `.env` reference vs current code

#### Variables that are already wired and used today

- `SIDECAR_PORT`
- `OVERLAY_API_PORT`
- `VITE_OVERLAY_API_URL`
- `SIDECAR_MOCK_SCENARIO`
- `OPENCLAW_RUNTIME_ROOT`
- `OPENCLAW_CONFIG_FILE`
- `OPENCLAW_WORKSPACE_GLOB`
- `OPENCLAW_SOURCE_ROOT`

#### Variables that are currently only reserved and not wired yet

- `SIDECAR_SOURCE`
- `OPENCLAW_GATEWAY_URL`
- `OPENCLAW_DASHBOARD_URL`
- `OPENCLAW_LOG_GLOB`

So your `.env` is a good operator reference, but those four reserved variables do not change runtime behavior yet.

### Recommended `.env`

```env
SIDECAR_PORT=4310
OVERLAY_API_PORT=4300
VITE_OVERLAY_API_URL=http://localhost:4300

# Keep mock as the default fallback
SIDECAR_MOCK_SCENARIO=baseline

# Phase 1.4 local read-only filesystem adapter
OPENCLAW_RUNTIME_ROOT=/home/zhangsy/.openclaw
OPENCLAW_CONFIG_FILE=/home/zhangsy/.openclaw/openclaw.json
OPENCLAW_WORKSPACE_GLOB=/home/zhangsy/.openclaw/workspace*
OPENCLAW_SOURCE_ROOT=/home/zhangsy/code/openclaw
```

### Other currently supported runtime variables

- `SIDECAR_BASE_URL`
  - upstream sidecar URL used by overlay-api
  - default: `http://localhost:4310`
- `SIDECAR_TIMEOUT_MS`
  - sidecar read timeout used by overlay-api
  - default: `5000`
- `OVERLAY_WEB_PORT`
  - overlay-web local dev port
  - default: `5173`
- `OVERLAY_API_PROXY_TARGET`
  - Vite development proxy target
  - default: `http://localhost:4300`
- `HOST_SIDECAR_PORT`
- `HOST_OVERLAY_API_PORT`
- `HOST_OVERLAY_WEB_PORT`
  - mainly used for Docker Compose published ports

Notes:

- if `VITE_OVERLAY_API_URL` is unset, the web app uses same-origin `/api` and `/health`
- if it is set to `http://localhost:4300`, the browser calls overlay-api directly

### Local startup

#### Default mock mode

```bash
corepack pnpm install
corepack pnpm dev
```

#### Local OpenClaw filesystem read-only mode

```bash
OPENCLAW_RUNTIME_ROOT=/home/zhangsy/.openclaw \
OPENCLAW_CONFIG_FILE=/home/zhangsy/.openclaw/openclaw.json \
OPENCLAW_WORKSPACE_GLOB='/home/zhangsy/.openclaw/workspace*' \
OPENCLAW_SOURCE_ROOT=/home/zhangsy/code/openclaw \
corepack pnpm dev
```

Local URLs:

- Overlay Web: `http://localhost:5173`
- Overlay API: `http://localhost:4300`
- Sidecar: `http://localhost:4310`

### Docker startup

```bash
docker compose up --build
```

Notes:

- compose remains mock-first by default
- it does not mount a local OpenClaw runtime directory by default
- for filesystem adapter usage, process mode is currently the better path

### Quality checks

```bash
corepack pnpm guard:readonly
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm check
```

### Current limitations

- still v0.1 alpha
- still strictly read-only
- still mock-first by default
- the only real adapter currently implemented is the local filesystem adapter
- real gateway HTTP / dashboard / log / CLI adapters are not wired yet
- no RBAC
- no real-time event bus
- no chat, prompt editing, execution control, or write-back features
