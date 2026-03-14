# OpenClaw Team Ops Console

**Read-only Governance and Visibility for OpenClaw runtimes**

## 中文

OpenClaw Team Ops Console 当前是一套面向内部评审的 **v0.2 governance preview**：

- 独立运行，不依赖修改 OpenClaw core
- 严格只读，不提供写回、控制、终止、编辑、创建等能力
- 默认 `mock-first`
- 保持 `sidecar + overlay-api + overlay-web` 三层架构
- 把产品定位从“资源目录台”推进到“治理观察台”

### 当前已经落地的能力

#### 治理层
- `Targets`：目标注册表，支持单目标和 `SIDECAR_TARGETS_FILE` 多目标注册
- `Risks`：按严重级别、目标、类型聚合的风险视图
- `Findings`：发现清单，支持下钻到详情
- `Evidence`：标准化证据清单，支持 path / field 引用
- `Recommendations`：只读建议检查项，不执行任何动作

#### 资源层
- `Overview`
- `Agents`
- `Workspaces`
- `Sessions`
- `Bindings`
- `Auth Profiles`
- `Topology`

#### 数据源层
- `mock`
  - 默认模式
  - 支持 `baseline`、`partial-coverage`、`stale-observability`、`error-upstream`
- `filesystem`
  - 只读扫描本地 OpenClaw runtime/config/workspace 路径
  - 缺失文件时以 `warnings + partial/unavailable + degraded` 方式降级
- `target registry`
  - 通过 `SIDECAR_TARGETS_FILE` 注册多个目标
  - 每个 target 可独立使用 `mock` 或 `filesystem` 数据源

### 当前读取模型（Read Model）

OpenClaw Team Ops Console 当前只读观察 OpenClaw 的三类外部状态，不写回、不控制：

| 类别 | 典型来源 | 用途 |
|---|---|---|
| Gateway config | `openclaw.json`、`OPENCLAW_CONFIG_PATH` 指向的配置、`$include` 引用文件 | 解析 `agents`、`bindings`、`session.store`、workspace 默认值 |
| Agent workspace | `workspace*` 下的 Markdown、`memory/`、`skills/` | 展示 bootstrap 文件、workspace 结构、目录健康度、只读预览 |
| Agent runtime state | `agents/<agentId>/agent/`、`agents/<agentId>/sessions/`、legacy `sessions/` | 展示 auth profiles、sessions、freshness、只读拓扑关系 |

### 当前实际读取的文件与目录

#### A. OpenClaw config
- `${OPENCLAW_CONFIG_FILE}`
- `${OPENCLAW_CONFIG_PATH}`
- `<stateDir>/openclaw.json`
- `<stateDir>/clawdbot.json`
- `<stateDir>/moldbot.json`
- `<stateDir>/moltbot.json`
- 读取目的：
  - 解析 `agents.defaults.workspace`
  - 解析 `agents.list[].id / name / workspace / agentDir`
  - 解析 `bindings`
  - 解析 `session.store`
  - 递归解析 `$include`

#### B. Agent runtime state
- `<stateDir>/agents/<agentId>/agent/auth-profiles.json`
  - 用于只读展示 auth profile 数量、provider、状态摘要
- `<stateDir>/agents/<agentId>/sessions/sessions.json`
  - 用于只读展示 session 列表、活跃时间、归属 agent、freshness
- `<stateDir>/sessions/sessions.json`
  - 当前版本只用于官方文档中 main/default agent 的 legacy 兼容回退
- `<stateDir>/agents/<agentId>/sessions/*.jsonl`
  - 当前版本**不读取 transcript 内容**
  - 当前只使用 `sessions.json` 元数据，不做 transcript 级浏览

#### C. Agent workspace
- `${workspace}/AGENTS.md`
- `${workspace}/SOUL.md`
- `${workspace}/TOOLS.md`
- `${workspace}/BOOTSTRAP.md`
- `${workspace}/BOOT.md`
- `${workspace}/IDENTITY.md`
- `${workspace}/USER.md`
- `${workspace}/HEARTBEAT.md`
- `${workspace}/MEMORY.md`
- `${workspace}/memory.md`
- `${workspace}/memory/`
- `${workspace}/skills/`

说明：

- 所有读取均为只读扫描，不创建、不修改、不删除任何文件
- 缺失文件显示为 `partial` / `warning` / `degraded`，不会自动补齐
- `OPENCLAW_SOURCE_ROOT` 仅用于展示来源元信息，不会 import 或执行 OpenClaw 源码

### 菜单功能与代码透明

| 菜单 | 读取对象 | 主要展示 | 明确不做 |
|---|---|---|---|
| Overview | summary snapshot | 整体健康度、计数、warnings、freshness | 不做控制台写操作 |
| Targets | target registry + snapshot summary | target 列表、source、env、freshness、coverage、risk score | 不编辑 target，不发起控制 |
| Risks | findings 聚合视图 | 风险总览、严重级别、目标聚合 | 不自动修复 |
| Findings | evidence + derived rules | 风险结论、影响范围、建议检查项 | 不下发治理动作 |
| Evidence | warnings + collection metadata + derived evidence | 路径引用、字段引用、观测时间、source | 不修改任何源文件 |
| Agents | config + runtime | agent 列表、workspace、auth、session 汇总 | 不创建/删除 agent |
| Workspaces | workspace files | bootstrap 文件、memory/skills 目录、只读预览 | 不编辑任何 Markdown |
| Sessions | `sessions.json` metadata | session 列表、活跃时间、归属 agent、freshness | 不 reset / prune / send |
| Bindings | config bindings | 渠道与 agent 的绑定关系 | 不 bind / unbind |
| Auth Profiles | `auth-profiles.json` | profile 数量、provider、状态摘要 | 不登录、不刷新 token |
| Topology | 聚合 snapshot | config / workspace / sessions / bindings 的关系图 | 不调度、不路由 |

### 代码透明与非目标

OpenClaw Team Ops Console 的目标是“外部只读观察”，不是“第二个 Gateway”。

#### 本项目明确会做的事
- 只读扫描 OpenClaw 外部状态
- 聚合成稳定的 `SystemSnapshot`
- 通过 GET-only API 和只读 Web UI 展示
- 对缺失、陈旧、不一致状态输出 `warning`、`partial`、`freshness`

#### 本项目明确不会做的事
- 不修改 OpenClaw core
- 不 import OpenClaw 内部源码模块
- 不写回 `openclaw.json`
- 不写回 workspace Markdown
- 不写回 `auth-profiles.json`
- 不写回 `sessions.json`
- 不执行 `bind / unbind / create / delete / stop / restart`
- 不作为 chat UI，不替代 official dashboard
- 不 patch / fork / vendor / runtime injection

### 为什么是 Governance，不是 Control

本仓库关注的是：

- 哪些 target 存在风险
- 风险来自哪些证据
- 哪些数据不完整、已过期、或存在解析异常
- 人应该去检查什么

本仓库**不做**：

- 写本地文件
- 调 OpenClaw 写接口
- 终止会话 / 重启 agent / 应用配置
- chat UX、prompt 编辑、执行控制
- patch / fork / vendor / runtime injection

### 架构概览

```text
OpenClaw runtime or mock data
        |
        v
     sidecar
        |
        v
    overlay-api
        |
        v
    overlay-web
```

### 快速启动

```bash
corepack pnpm install
cp .env.example .env
corepack pnpm dev
```

默认本地地址：

- Overlay Web: `http://localhost:5173`
- Overlay API: `http://localhost:4300`
- Sidecar: `http://localhost:4310`

如果你想把前端改到 `9527`，可在 `.env` 中设置：

```env
OVERLAY_WEB_PORT=9527
HOST_OVERLAY_WEB_PORT=9527
```

### 默认模式与切换规则

#### 1. 默认 mock 模式

在没有配置本地 OpenClaw 路径时，sidecar 默认使用 `mock`。

#### 2. filesystem 只读模式

当以下任一变量被设置时，sidecar 会切到 `filesystem` adapter：

- `OPENCLAW_RUNTIME_ROOT`
- `OPENCLAW_STATE_DIR`
- `OPENCLAW_CONFIG_FILE`
- `OPENCLAW_CONFIG_PATH`
- `OPENCLAW_WORKSPACE_GLOB`
- `OPENCLAW_PROFILE`

说明：

- 状态目录解析顺序：
  `OPENCLAW_RUNTIME_ROOT -> OPENCLAW_STATE_DIR -> profile 默认值`
- profile 默认状态目录：
  非 `default` 时为 `~/.openclaw-<profile>`，否则为 `~/.openclaw`
- 配置文件解析顺序：
  `OPENCLAW_CONFIG_FILE -> OPENCLAW_CONFIG_PATH -> 状态目录下已存在配置 -> <stateDir>/openclaw.json`
- workspace 解析顺序：
  `OPENCLAW_WORKSPACE_GLOB -> ~/.openclaw/workspace*`
- session store 解析顺序：
  `session.store -> <stateDir>/agents/<agentId>/sessions/sessions.json -> <stateDir>/sessions/sessions.json（仅 main/default agent 兼容回退）`
- `OPENCLAW_SOURCE_ROOT` 仅用于展示 source metadata
- `SIDECAR_SOURCE` 目前仍不是实际生效的切换开关

#### 3. 多 target 注册表

当 `SIDECAR_TARGETS_FILE` 被设置时，sidecar 会从目标注册表文件中读取多个 target。

示例文件见：[examples/targets.registry.example.json](examples/targets.registry.example.json)

### 常用环境变量

#### sidecar
- `SIDECAR_PORT`
- `SIDECAR_MOCK_SCENARIO`
- `SIDECAR_TARGET_ID`
- `SIDECAR_TARGET_NAME`
- `SIDECAR_TARGET_ENVIRONMENT`
- `SIDECAR_TARGET_OWNER`
- `SIDECAR_TARGETS_FILE`
- `OPENCLAW_RUNTIME_ROOT`
- `OPENCLAW_STATE_DIR`
- `OPENCLAW_CONFIG_FILE`
- `OPENCLAW_CONFIG_PATH`
- `OPENCLAW_WORKSPACE_GLOB`
- `OPENCLAW_PROFILE`
- `OPENCLAW_SOURCE_ROOT`
- `OPENCLAW_GATEWAY_URL`（当前仅用于元信息展示）
- `OPENCLAW_DASHBOARD_URL`（当前仅用于元信息展示）
- `OPENCLAW_LOG_GLOB`（当前预留，未接线）

#### overlay-api
- `OVERLAY_API_PORT`
- `SIDECAR_BASE_URL`
- `SIDECAR_TIMEOUT_MS`

#### overlay-web
- `OVERLAY_WEB_PORT`
- `OVERLAY_API_PROXY_TARGET`
- `VITE_OVERLAY_API_URL`
- `HOST_SIDECAR_PORT`
- `HOST_OVERLAY_API_PORT`
- `HOST_OVERLAY_WEB_PORT`

### 当前主要页面

- `/`
- `/targets`
- `/targets/:id`
- `/risks`
- `/findings`
- `/findings/:id`
- `/evidence`
- `/evidence/:id`
- `/agents`
- `/workspaces`
- `/sessions`
- `/bindings`
- `/auth-profiles`
- `/topology`

### 当前主要只读 API

- `GET /health`
- `GET /api/summary`
- `GET /api/targets`
- `GET /api/targets/:id`
- `GET /api/targets/:id/summary`
- `GET /api/evidence`
- `GET /api/evidence/:id`
- `GET /api/findings`
- `GET /api/findings/:id`
- `GET /api/recommendations`
- `GET /api/recommendations/:id`
- `GET /api/risks/summary`
- `GET /api/agents`
- `GET /api/agents/:id`
- `GET /api/workspaces`
- `GET /api/workspaces/:id/documents/:fileName`
- `GET /api/sessions`
- `GET /api/bindings`
- `GET /api/auth-profiles`
- `GET /api/topology`
- `GET /api/runtime-status`

### v0.2 scope

v0.2 当前聚焦：

- Target Registry
- Evidence / Findings / Risks 治理链路
- Recommendation 建议式运维
- 多目标只读观察
- 保持 mock + filesystem 两类基础模式

### non-goals

- 不做真实写操作
- 不做业务型 `POST / PUT / PATCH / DELETE`
- 不做 chat 前端
- 不做审批流
- 不做 RBAC 落地
- 不做远程执行
- 不通过前端或 sidecar 写本地文件

### 质量检查

```bash
corepack pnpm guard:readonly
corepack pnpm typecheck
corepack pnpm test
corepack pnpm playwright:install
corepack pnpm test:e2e
corepack pnpm build
corepack pnpm check
```

### 文档索引

- [docs/architecture.md](docs/architecture.md)
- [docs/api-contract.md](docs/api-contract.md)
- [docs/deployment-local.md](docs/deployment-local.md)
- [docs/local-path-integration.md](docs/local-path-integration.md)
- [docs/mock-scenarios.md](docs/mock-scenarios.md)
- [docs/roadmap-v0.2.md](docs/roadmap-v0.2.md)
- [docs/why-governance-not-control.md](docs/why-governance-not-control.md)
- [docs/v0.2-changelog.md](docs/v0.2-changelog.md)
- [docs/v0.2-api-examples.md](docs/v0.2-api-examples.md)
- [docs/v0.2-demo-scenarios.md](docs/v0.2-demo-scenarios.md)
- [docs/v0.2-known-limitations.md](docs/v0.2-known-limitations.md)
- [docs/v0.2-information-architecture.md](docs/v0.2-information-architecture.md)
- [docs/v0.2-governance-flow.md](docs/v0.2-governance-flow.md)
- [docs/v0.2-dto-changes.md](docs/v0.2-dto-changes.md)
- [docs/v0.2-api-changes.md](docs/v0.2-api-changes.md)
- [docs/v0.2-validation-log.md](docs/v0.2-validation-log.md)
- [docs/v0.2-acceptance-checklist.md](docs/v0.2-acceptance-checklist.md)

### 已知限制

- 当前仍是内部 alpha / preview 形态
- `filesystem` 是唯一真实 adapter
- `gateway / dashboard / logs / cli` 仍未接真实采集
- 当前只落地了 1 条最小浏览器级 E2E，用于验证只读治理主链路
- 页面截图交付物仍需单独补充

---

## English

OpenClaw Team Ops Console currently ships as a **v0.2 governance preview** for internal evaluation:

- standalone, with no OpenClaw core changes required
- strictly read-only
- mock-first by default
- still built as `sidecar + overlay-api + overlay-web`
- moving from an inventory console toward a governance and visibility console

### What is implemented today

#### Governance layer
- `Targets` for target registry and fleet visibility
- `Risks` for aggregated governance signals
- `Findings` for detailed issue review and drill-down
- `Evidence` for normalized, traceable evidence records
- `Recommendations` as read-only suggested checks

#### Resource layer
- `Overview`
- `Agents`
- `Workspaces`
- `Sessions`
- `Bindings`
- `Auth Profiles`
- `Topology`

#### Source layer
- `mock` remains the default mode
- `filesystem` reads local OpenClaw runtime paths in read-only mode
- `SIDECAR_TARGETS_FILE` enables multiple registered targets, each with its own source configuration

### Current Read Model

OpenClaw Team Ops Console reads three classes of external OpenClaw state in read-only mode. It does not write back or control the runtime:

| Category | Typical sources | Purpose |
|---|---|---|
| Gateway config | `openclaw.json`, the path from `OPENCLAW_CONFIG_PATH`, and `$include` references | Parse `agents`, `bindings`, `session.store`, and workspace defaults |
| Agent workspace | Markdown files plus `memory/` and `skills/` under `workspace*` directories | Show bootstrap coverage, workspace structure, health posture, and read-only previews |
| Agent runtime state | `agents/<agentId>/agent/`, `agents/<agentId>/sessions/`, and legacy `sessions/` | Show auth profiles, sessions, freshness, and read-only topology relationships |

### Files And Directories Currently Read

#### A. OpenClaw config
- `${OPENCLAW_CONFIG_FILE}`
- `${OPENCLAW_CONFIG_PATH}`
- `<stateDir>/openclaw.json`
- `<stateDir>/clawdbot.json`
- `<stateDir>/moldbot.json`
- `<stateDir>/moltbot.json`
- Read purposes:
  - parse `agents.defaults.workspace`
  - parse `agents.list[].id / name / workspace / agentDir`
  - parse `bindings`
  - parse `session.store`
  - recursively resolve `$include`

#### B. Agent runtime state
- `<stateDir>/agents/<agentId>/agent/auth-profiles.json`
  - used for read-only auth-profile counts, provider hints, and status summaries
- `<stateDir>/agents/<agentId>/sessions/sessions.json`
  - used for read-only session inventory, activity times, agent ownership, and freshness
- `<stateDir>/sessions/sessions.json`
  - currently used only as the documented legacy fallback for the main/default agent
- `<stateDir>/agents/<agentId>/sessions/*.jsonl`
  - the current version does **not** read transcript contents
  - this release only uses `sessions.json` metadata

#### C. Agent workspace
- `${workspace}/AGENTS.md`
- `${workspace}/SOUL.md`
- `${workspace}/TOOLS.md`
- `${workspace}/BOOTSTRAP.md`
- `${workspace}/BOOT.md`
- `${workspace}/IDENTITY.md`
- `${workspace}/USER.md`
- `${workspace}/HEARTBEAT.md`
- `${workspace}/MEMORY.md`
- `${workspace}/memory.md`
- `${workspace}/memory/`
- `${workspace}/skills/`

Notes:

- all reads are read-only scans; no files are created, modified, or deleted
- missing files surface as `partial`, `warning`, or `degraded`; they are never auto-healed
- `OPENCLAW_SOURCE_ROOT` is informational metadata only and is never imported or executed

### Menu Transparency

| Menu | Reads | Main display | Explicitly does not do |
|---|---|---|---|
| Overview | summary snapshot | fleet health, counts, warnings, freshness | no control-plane writes |
| Targets | target registry + snapshot summary | targets, source, environment, freshness, coverage, risk score | no target editing or control actions |
| Risks | aggregated findings | risk overview, severity, target grouping | no auto-remediation |
| Findings | evidence + derived rules | governance conclusions, impact, recommended checks | no downstream governance action |
| Evidence | warnings + collection metadata + derived evidence | path refs, field refs, observed times, source metadata | no source mutation |
| Agents | config + runtime | agent inventory, workspace, auth, and session rollups | no agent create/delete |
| Workspaces | workspace files | bootstrap files, memory/skills directories, read-only preview | no Markdown editing |
| Sessions | `sessions.json` metadata | sessions, activity time, owning agent, freshness | no reset / prune / send |
| Bindings | config bindings | channel-to-agent routing relationships | no bind / unbind |
| Auth Profiles | `auth-profiles.json` | profile counts, provider hints, status summaries | no login or token refresh |
| Topology | aggregated snapshot | relationships across config, workspaces, sessions, and bindings | no scheduling or routing |

### Transparency And Non-goals

OpenClaw Team Ops Console is meant to be an external read-only observer, not a second Gateway.

#### This project explicitly does
- read external OpenClaw state in read-only mode
- normalize that state into a stable `SystemSnapshot`
- expose it through GET-only APIs and a read-only web UI
- surface missing, stale, or inconsistent state as `warning`, `partial`, and freshness metadata

#### This project explicitly does not do
- modify OpenClaw core
- import internal OpenClaw source modules
- write back `openclaw.json`
- write back workspace Markdown
- write back `auth-profiles.json`
- write back `sessions.json`
- execute `bind / unbind / create / delete / stop / restart`
- act as a chat UI or replace the official dashboard
- patch, fork, vendor, or inject into the OpenClaw runtime

### Why governance, not control

This repository is designed to answer:

- which targets look risky
- what evidence supports that judgment
- where data is partial, stale, or unavailable
- what an operator should inspect next

This repository does **not**:

- mutate OpenClaw state
- expose write-oriented endpoints
- provide chat UX or execution control
- patch, fork, vendor, or inject into OpenClaw runtime

### Quickstart

```bash
corepack pnpm install
cp .env.example .env
corepack pnpm dev
```

Default local URLs:

- Overlay Web: `http://localhost:5173`
- Overlay API: `http://localhost:4300`
- Sidecar: `http://localhost:4310`

### Mode selection

- no local runtime paths configured -> `mock`
- any of `OPENCLAW_RUNTIME_ROOT`, `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_FILE`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_WORKSPACE_GLOB`, or `OPENCLAW_PROFILE` configured -> `filesystem`
- `SIDECAR_TARGETS_FILE` configured -> target registry mode with one or more targets

`OPENCLAW_SOURCE_ROOT` is informational only. `SIDECAR_SOURCE` is still not the live adapter switch.

Filesystem resolution order:

- state dir: `OPENCLAW_RUNTIME_ROOT -> OPENCLAW_STATE_DIR -> ~/.openclaw-<profile> -> ~/.openclaw`
- config: `OPENCLAW_CONFIG_FILE -> OPENCLAW_CONFIG_PATH -> existing config candidate in the state dir -> <stateDir>/openclaw.json`
- workspaces: `OPENCLAW_WORKSPACE_GLOB -> ~/.openclaw/workspace*`
- sessions: `session.store -> agents/<agentId>/sessions/sessions.json -> sessions/sessions.json` for the main/default agent legacy fallback

### Local filesystem example

```bash
OPENCLAW_STATE_DIR=/home/your-user/.openclaw \
OPENCLAW_CONFIG_PATH=/home/your-user/.openclaw/openclaw.json \
OPENCLAW_WORKSPACE_GLOB='/home/your-user/.openclaw/workspace*' \
OPENCLAW_PROFILE=default \
OPENCLAW_SOURCE_ROOT=/home/your-user/code/openclaw \
corepack pnpm dev
```

### Quality gates

```bash
corepack pnpm playwright:install
corepack pnpm test:e2e
corepack pnpm check
```

### Browser E2E

The repository now includes one minimal browser-level E2E that validates the read-only governance flow with the `partial-coverage` mock fixture:

`Risks -> Finding Detail -> Evidence -> Recommendation`

It asserts:

- key page text is present
- evidence records are present
- recommendations are present
- the flow remains read-only

Current test name:

- `browser e2e: mock governance flow stays read-only from risks to finding detail, evidence, and recommendations`

On Linux/WSL, `corepack pnpm test:e2e` automatically prepares a small local library bundle for Playwright Chromium when system libraries are missing.

### Current non-goals

- write operations
- business `POST / PUT / PATCH / DELETE`
- chat UX
- remote execution
- RBAC rollout
- approval workflows

### Known limitations

- internal alpha / preview only
- filesystem is the only real adapter today
- only one minimal browser-level E2E is in place today
- browser-level screenshots are still pending
- gateway, dashboard, log, and CLI adapters are not implemented yet, but `openclaw gateway status --json`, `openclaw health --json`, and allowlisted read-only `openclaw gateway call ...` surfaces are confirmed external inputs
