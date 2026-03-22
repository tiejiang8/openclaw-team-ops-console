# Roadmap v0.3 alpha

## Current status

The repository already has the core governance spine in place for `v0.3 alpha` review:

- role-based workbenches in `overlay-web`
- read-only governance chain: `Evidence -> Finding -> Recommendation`
- multi-target readiness via `SIDECAR_TARGETS_FILE`
- explicit read-only runtime-plane integration via `operator.read`
- mock-first plus filesystem-backed source collection

This means the current milestone is no longer about proving the console can exist. It is about making the existing scope easier to trust, easier to review, and easier to operate at larger scale.

## Key risks and opportunities

### High-priority risks

1. Version narrative can drift unless README, reviewer docs, and package metadata keep one `v0.3 alpha` story.
2. Metric credibility is documented, but not every key KPI explains confidence, coverage, sample window, and degrade reason at the point of use.
3. Multi-target scale still depends on polling plus a static local registry, which will raise latency and maintenance cost in broader team rollouts.

### High-value opportunities

1. The `Evidence / Finding / Recommendation` chain can grow naturally into a governance collaboration layer.
2. The read-only boundary is already engineered into the product and can become a clearer trust label in external review.
3. Role-based IA is already in place, which makes role-specific KPIs and action templates a practical next step.

## Suggested delivery path

### P0 (2 weeks): unify external narrative and review scope

- keep one release label everywhere: `v0.3 alpha`
- keep one scope table in `README.md`
- keep one canonical limitations list in `docs/v0.3-known-limitations.md`
- keep one roadmap document that separates implemented, experimental, and explicitly out-of-scope items

Acceptance:

- any new reviewer can explain what the product is, what it is not, and what stage it is in within 10 minutes

### P1 (2 to 4 weeks): turn metric credibility into a product capability

- show `confidence`, `coverage`, `sample window`, and `degrade reason` on core adoption metrics
- mark proxy metrics with clear UI signals such as `proxy` badges or `~` values
- provide a fast in-product jump to "how this metric is calculated"

Acceptance:

- reviewers do not mistake proxy or observational metrics for audit-grade business facts

### P2 (4 to 8 weeks): add a governance collaboration loop without breaking read-only boundaries

- add local overlay state for recommendation handling such as `ack`, `snooze`, `owner`, and `dueDate`
- add SLA, timeout, and recurrence markers for risk items
- add review trail and export support for who reviewed what and when

Acceptance:

- users can complete `finding -> ownership -> tracking -> review` inside the console without writing back to OpenClaw

### P3 (parallel exploration): improve real-time posture and multi-target scale

- move web refresh from polling toward SSE or push-driven updates
- add optional discovery for targets while keeping it read-only and disableable
- introduce cross-target baselines and percentiles for health and risk posture

Acceptance:

- multi-team review remains timely and low-maintenance as target count grows

## North-star metrics

Recommended governance-value metrics:

- `MTTI-evidence`: median time from anomaly appearance to evidence identification
- critical finding confirmation latency (`P50 / P90`)
- configuration drift detection coverage
- recovery time for `stale` or `unavailable` collections
- weekly share of recommendations that are viewed and enter tracking

Not recommended as the primary north-star:

- raw chat/session growth alone

For this product, the more important signal is conversion from governance visibility into governance action.
