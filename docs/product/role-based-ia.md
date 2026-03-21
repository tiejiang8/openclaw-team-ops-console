# Role-Based Information Architecture

OpenClaw Team Ops Console now leads with role-oriented workbenches instead of a flat resource-first menu.

The current v0.3 emphasis is not “more KPI density”. It is credibility tightening: clearer empty states, proxy labeling, and more consistent role-language across Overview, Operations, Adoption, Outcomes, Governance, and Evidence.

## Primary role views

- `Overview` (`/`)
  - Executive landing page for the four first-pass questions: stability, adoption, outcome, and risk.
- `Operations` (`/operations`)
  - Daily runtime response view for node health, cron drift, hotspots, and configuration hygiene.
- `Adoption` (`/adoption`)
  - Usage growth view for sessions, workspaces, agents, and repeat-usage proxy signals.
- `Outcomes` (`/outcomes`)
  - Management roll-up for team coverage, repeat usage, and rollout blockers.
- `Governance` (`/governance`)
  - Risk posture, compliance gaps, findings, recommendations, and evidence-backed traceability.
- `Evidence` (`/evidence`)
  - Engineering traceability lens for logs, evidence, topology, and target drill-down.

## Supporting detail views

The original read-only routes stay intact and are now grouped under the role lens most likely to need them next.

- `Operations`
  - `/nodes`
  - `/cron`
  - `/activity`
  - `/coverage`
  - `/logs`
- `Adoption`
  - `/sessions`
  - `/agents`
  - `/workspaces`
  - `/fleet-map`
- `Outcomes`
  - `/`
  - `/fleet-map`
  - `/workspaces`
  - `/sessions`
- `Governance`
  - `/risks`
  - `/findings`
  - `/recommendations`
  - `/auth-profiles`
  - `/bindings`
- `Evidence`
  - `/evidence`
  - `/logs`
  - `/topology`
  - `/targets`

## Design rules

- Keep the product read-only. No role page introduces write-back, execution, or remediation actions.
- Let the dashboard answer “what needs attention?” before the user opens a raw inventory page.
- Prefer explicit explanatory empty states over silent blank panels when a chart or ranking has no meaningful signal yet.
- Mark proxy, early-signal, and limited-sample metrics clearly so the UI does not over-claim what the current data can support.
- Every major dashboard card must retain a path back to existing detail pages or evidence records.
- Preserve old routes so existing links, docs, and habits do not break while the IA evolves.
