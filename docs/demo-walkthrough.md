# 5-Minute Demo Walkthrough

This guide provides a recommended path for demonstrating the **OpenClaw Team Ops Console (v0.3 Alpha)**.

## Goal
Showcase the console as a **read-only governance and visibility layer** that aggregates fleet-wide state, signals risks, and provides actionable recommendations without executing changes.

---

## Step 1: Overview Dashboard (`/`)
*   **Narrative**: Start with the "big picture". The dashboard shows the total inventory (Agents, Targets, Findings) and live runtime health.
*   **Key Points**:
    *   **Runtime Status Bar**: Real-time connectivity and collection status (SSE).
    *   **Fleet High-level Metrics**: Immediate visibility into "Fleet Risk" and "Critical Findings".
*   **Action**: Point out the "Overlay API health" and the "Snapshot Time".

## Step 2: Fleet Map (`/fleet-map`)
*   **Narrative**: Transition from metrics to structure. The Fleet Map visualizes how your OpenClaw runtime is actually laid out.
*   **Key Points**:
    *   **Topology View**: Visualize Host -> Workspace -> Agent -> Session hierarchy.
    *   **Governance Overlay**: (Toggle to Governance) Identify which nodes have freshness warnings or associated findings.
*   **Action**: Click on a "Degraded" node to show the **Node Inspector** on the right.

## Step 3: Activity Center (`/activity`)
*   **Narrative**: "What just happened?" The unified timeline aggregates events from all sources.
*   **Key Points**:
    *   **Unified Feed**: See Cron jobs, Node connections, and Logs in one place.
    *   **Traceability**: Each event links back to the source node or log.
*   **Action**: Filter by "Cron" or "Critical" to show focused signals.

## Step 4: Governance Loop (`Risks -> Findings -> Evidence -> Recommendations`)
*   **Narrative**: This is the core "value loop" of the console.
*   **The Path**:
    1.  **Risks (`/risks`)**: Show the list of current governance risks (e.g., "Orphan Session", "Config Drift").
    2.  **Finding Detail**: Click a risk to see the specific finding.
    3.  **Evidence (`/evidence`)**: Show the "Evidence Chain" (why this is a risk).
    4.  **Recommendations (`/recommendations`)**: Show the **Suggested Checks**.
*   **Key Points**:
    *   **Strictly Read-Only**: Notice there are no "Fix" or "Execute" buttons.
    *   **Validation Steps**: The console tells the operator *how* to verify and fix it in OpenClaw core.

---

## Summary for Handoff
*   **Positioning**: Read-only observation, not control.
*   **Architecture**: Sidecar/API/Web three-layer stack.
*   **Value**: Visibility into complex, multi-target OpenClaw fleets.
