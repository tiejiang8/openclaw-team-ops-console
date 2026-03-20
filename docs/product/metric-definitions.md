# Metric Definitions

This document records the current v1 definitions for role-based dashboard metrics. These are intentionally pragmatic read-only roll-ups rather than canonical business reporting metrics.

## activeUsersProxy

- Purpose: estimate whether usage is broadening without requiring a first-class user identity model.
- Current definition:
  - Count unique `workspaceId`, else `agentId`, else `bindingId`, else `channel`
  - Only for sessions active in the last 24 hours
- Why `proxy`:
  - The console reads OpenClaw state and runtime snapshots, not a dedicated user profile system
  - A single human may appear through different channels or workspaces

## repeatUsageRatio

- Purpose: estimate whether usage is repeating instead of remaining one-off.
- Current definition:
  - Look at sessions active in the last 7 days
  - Group by `workspaceId`, else `agentId`, else `channel`
  - `repeatUsageRatio = repeated groups / total active groups * 100`
  - A repeated group is a group with at least 2 sessions during the 7-day window

## healthScore

- Purpose: compress operational stability into one top-line signal for Overview and Operations.
- Current heuristic:
  - Start from `100`
  - Deduct for:
    - 24h log errors
    - stale nodes
    - overdue cron jobs
    - critical findings
    - config mismatches
    - degraded or disconnected gateway state
- Notes:
  - This is not a canonical SLO
  - It is a prioritization aid for a read-only workbench

## configMismatchCount

- Purpose: highlight governance drift that directly affects safe rollout and runtime trust.
- Current definition:
  - Count findings whose type is:
    - `config-include-anomaly`
    - `workspace-drift`
- Interpretation:
  - This is a read-only mismatch signal, not an automated repair queue

## authCoverageGapCount

- Purpose: surface authentication posture issues that block broader operational or team rollout confidence.
- Current definition:
  - Count auth profiles whose status is `expired` or `disabled`
- Notes:
  - The console does not renew tokens or change auth state
  - This metric is meant to signal operator review load

## High-Value Teams / Workspaces

- High-intensity workspace
  - A workspace with at least `12` turns across recent sessions
- Repeated-usage team
  - A team that has at least one workspace with `2+` sessions in the 7-day window
- Active team
  - A team with at least one workspace that had session activity in the last 7 days

## Important caveats

- All metrics remain read-only and derived from currently available snapshot/runtime facts.
- Mock mode and filesystem mode use the same definitions, but their fidelity differs with available source coverage.
- These definitions are intentionally simple so every dashboard conclusion can still be traced back to existing detail pages and evidence records.
