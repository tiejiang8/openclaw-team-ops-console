# Why Governance, Not Control

## Short answer

This console is intentionally designed to help teams observe, explain, and review OpenClaw runtimes without taking action on those runtimes.

## Why this matters

OpenClaw is treated as an external system in this repository. That means the safest and most honest first product step is:

- inventory what exists
- measure freshness and coverage
- surface degraded or risky conditions
- point operators toward manual checks

That is governance.

Control would mean something different:

- restart or terminate workloads
- apply config changes
- write back acknowledgements or suppressions
- edit prompts, routes, or auth
- execute commands from the console

Those actions are intentionally out of scope.

## Product consequences

Because the product is governance-first:

- `overlay-api` stays GET-only
- findings always point back to evidence
- recommendations remain read-only suggestions
- the UI favors tables, traceability, and drill-down over action surfaces
- degraded and partial data remain visible instead of being hidden

## Operator consequences

Operators can answer:

- which targets are stale or degraded
- which findings are currently open
- what evidence supports a finding
- what files, paths, or checks a human should inspect next

Operators cannot:

- mutate OpenClaw state
- trigger silent remediation
- use the console as a control plane

## Boundary reminder

This is not a temporary omission in the current code. It is a deliberate product boundary for the current phase.
