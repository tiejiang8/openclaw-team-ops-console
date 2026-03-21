# Metric Definitions

This document records the current v1 definitions for role-based dashboard metrics. These are intentionally pragmatic read-only roll-ups rather than canonical business reporting metrics.

## Confidence levels

- Exact-ish / inventory metrics
  - Counts such as targets, nodes, cron jobs, open risks, and findings come directly from the current read-only snapshot or runtime plane.
  - They are still snapshot-bound, but they are closer to direct inventory facts than proxy metrics.
- Proxy metrics
  - Metrics such as `activeUsersProxy`, `repeatUsageRatio`, and `multiDayActiveUsers` infer usage breadth from visible session metadata.
  - They are useful for trend reading and rollout observation, not identity-accurate analytics.
- Observational metrics
  - Summaries such as average session duration, workspace heat, or early rollout signals may degrade to `0` or empty states when the supporting metadata is not visible enough.
  - The UI now explicitly labels these cases as `proxy`, `early signal`, or `limited sample`.

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

## How to read `0` and `unavailable`

- `0`
  - Means the current visible snapshot did not show that signal.
  - For proxy metrics, `0` should be read as “not currently observed”, not “proven absent forever”.
- `unavailable`
  - Means the supporting metadata or source coverage was not sufficient to compute the metric credibly.
  - The dashboard should prefer an explicit note or empty state over pretending the metric is complete.

## Exact vs observational reading

- Better treated as direct read-only facts
  - target count
  - node count
  - cron overdue count
  - open risks / findings
  - config mismatch count
- Better treated as observational or proxy
  - activeUsersProxy
  - repeatUsageRatio
  - multiDayActiveUsers
  - avgSessionDurationMinutes
  - high-intensity workspace / team adoption signals

## Important caveats

- All metrics remain read-only and derived from currently available snapshot/runtime facts.
- Mock mode and filesystem mode use the same definitions, but their fidelity differs with available source coverage.
- These definitions are intentionally simple so every dashboard conclusion can still be traced back to existing detail pages and evidence records.
