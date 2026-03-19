import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataState } from "../components/data-state.js";
import { PageObservability } from "../components/page-observability.js";
import { overlayApi } from "../lib/api.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";
import { StatusBadge } from "../components/status-badge.js";
import type { FleetMapNode, FleetMapEdge } from "@openclaw-team-ops/shared";

// ─── Layout constants ────────────────────────────────────────────────────────
const LAYER_GAP = 220;
const NODE_W = 160;
const NODE_H = 52;
const LAYER_Y: Record<string, number> = {
  target: 60,
  workspace: 60 + LAYER_GAP,
  agent: 60 + LAYER_GAP * 2,
};

// ─── Status helpers ───────────────────────────────────────────────────────────
type NodeHealth = "healthy" | "degraded" | "unavailable" | "unknown";

function getHealth(status: string): NodeHealth {
  const s = status?.toLowerCase() ?? "";
  if (!s || s === "unknown") return "unknown";
  if (["ok", "healthy", "active", "connected", "fresh", "running", "valid"].some((v) => s.includes(v))) return "healthy";
  if (["unavailable", "offline", "down", "missing", "expired", "error", "critical"].some((v) => s.includes(v))) return "unavailable";
  return "degraded";
}

// ─── Node icons ───────────────────────────────────────────────────────────────
const ICONS: Record<string, string> = {
  target: "◎",
  workspace: "⬡",
  agent: "◈",
  session: "◇",
  binding: "↯",
  "auth-profile": "⬟",
  "cron-job": "⊙",
  finding: "⚑",
};

function getIcon(type: string): string {
  return ICONS[type] ?? "●";
}

// ─── Drill-down paths ─────────────────────────────────────────────────────────
function getDrillDownPath(node: FleetMapNode): string | null {
  switch (node.nodeType) {
    case "target": return node.details?.["id"] ? `/targets/${String(node.details["id"])}` : "/targets";
    case "workspace": return node.details?.["id"] ? `/workspaces` : null;
    case "agent": return node.details?.["id"] ? `/agents` : null;
    case "session": return "/sessions";
    case "binding": return "/bindings";
    case "auth-profile": return "/auth-profiles";
    case "cron-job": return node.id ? `/cron/${encodeURIComponent(node.id)}` : "/cron";
    case "finding": return node.id ? `/findings/${encodeURIComponent(node.id)}` : "/findings";
    default: return null;
  }
}

// ─── Layout engine ─────────────────────────────────────────────────────────────
interface PositionedNode extends FleetMapNode {
  x: number;
  y: number;
  health: NodeHealth;
}

function computeLayout(nodes: FleetMapNode[]): PositionedNode[] {
  const byLayer: Record<string, FleetMapNode[]> = {};
  const visibleTypes = ["target", "workspace", "agent"];
  
  for (const n of nodes) {
    if (!visibleTypes.includes(n.nodeType)) continue;
    (byLayer[n.nodeType] ??= []).push(n);
  }
  const placed: PositionedNode[] = [];
  for (const [layer, layerNodes] of Object.entries(byLayer)) {
    const y = LAYER_Y[layer] ?? 60;
    const total = layerNodes.length;
    layerNodes.forEach((n, i) => {
      const x = (i - (total - 1) / 2) * (NODE_W + 40);
      placed.push({ ...n, x, y, health: getHealth(n.status) });
    });
  }
  return placed;
}

// ─── SVG edge path ────────────────────────────────────────────────────────────
function edgePath(
  fromNode: PositionedNode,
  toNode: PositionedNode,
): string {
  const x1 = fromNode.x + NODE_W / 2;
  const y1 = fromNode.y + NODE_H;
  const x2 = toNode.x + NODE_W / 2;
  const y2 = toNode.y;
  const cy = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${cy} ${x2} ${cy} ${x2} ${y2}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function FleetMapPage() {
  const { t, translateStatus, translateNodeType } = useI18n();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"topology" | "governance">("topology");
  const svgRef = useRef<SVGSVGElement>(null);

  const loadFleetMap = useCallback(() => overlayApi.getFleetMap(), []);
  const { data, loading, error, retry } = useResource("fleet-map", loadFleetMap);

  const positioned = useMemo<PositionedNode[]>(() => {
    if (!data) return [];
    return computeLayout(data.data.nodes);
  }, [data]);

  // Auto-selection logic
  useMemo(() => {
    if (!selectedId && positioned.length > 0) {
      // Find first anomalous node
      const anomalous = positioned.find(n => n.health === "unavailable" || n.health === "degraded");
      // Or first target
      const target = positioned.find(n => n.nodeType === "target");
      setSelectedId(anomalous?.id ?? target?.id ?? positioned[0]?.id ?? null);
    }
  }, [positioned, selectedId]);

  const associatedNodes = useMemo(() => {
    if (!selectedId || !data) return [];
    const connectedIds = new Set(
      data.data.edges
        .filter(e => e.fromId === selectedId || e.toId === selectedId)
        .map(e => e.fromId === selectedId ? e.toId : e.fromId)
    );
    return data.data.nodes.filter(n => connectedIds.has(n.id) && !["target", "workspace", "agent"].includes(n.nodeType));
  }, [selectedId, data]);

  const visibleNodeIds = useMemo(() => new Set(positioned.map(n => n.id)), [positioned]);

  const edges = useMemo<FleetMapEdge[]>(() => {
    if (!data) return [];
    return data.data.edges.filter(e => 
      (visibleNodeIds.has(e.fromId) && visibleNodeIds.has(e.toId)) ||
      (selectedId && (e.fromId === selectedId || e.toId === selectedId))
    );
  }, [data, visibleNodeIds, selectedId]);

  const posMap = useMemo(() => {
    const m: Record<string, PositionedNode> = {};
    for (const n of positioned) m[n.id] = n;
    return m;
  }, [positioned]);

  const selectedNode = useMemo(() => (selectedId ? (posMap[selectedId] ?? null) : null), [selectedId, posMap]);

  // Summary stats
  const summary = useMemo(() => {
    if (!data) return { targets: 0, workspaces: 0, agents: 0, warnings: 0, fresh: 0, total: 0 };
    const nodes = data.data.nodes;
    return {
      targets: nodes.filter((n) => n.nodeType === "target").length,
      workspaces: nodes.filter((n) => n.nodeType === "workspace").length,
      agents: nodes.filter((n) => n.nodeType === "agent").length,
      warnings: nodes.filter((n) => getHealth(n.status) === "degraded").length,
      fresh: nodes.filter((n) => getHealth(n.status) === "healthy").length,
      total: nodes.length,
    };
  }, [data]);

  // SVG canvas dimensions
  const { svgWidth, svgHeight } = useMemo(() => {
    if (!positioned.length) return { svgWidth: 900, svgHeight: 500 };
    const xs = positioned.map((n) => n.x);
    const ys = positioned.map((n) => n.y);
    return {
      svgWidth: Math.max(900, Math.max(...xs) + NODE_W + 80),
      svgHeight: Math.max(400, Math.max(...ys) + NODE_H + 80),
    };
  }, [positioned]);

  const drillDownPath = selectedNode ? getDrillDownPath(selectedNode) : null;

  return (
    <section className="page fade-in-up fleet-map-page">
      <header className="page-header">
        <div>
          <h2>{t("fleet-map.title")}</h2>
          <p>{t("fleet-map.description")}</p>
        </div>
        <div className="fleet-map-controls">
          <div className="view-toggle-group">
            <button
              className={`view-toggle-btn ${viewMode === "topology" ? "active" : ""}`}
              onClick={() => setViewMode("topology")}
            >
              {t("fleet-map.view-mode.topology")}
            </button>
            <button
              className={`view-toggle-btn ${viewMode === "governance" ? "active" : ""}`}
              onClick={() => setViewMode("governance")}
            >
              {t("fleet-map.view-mode.governance")}
            </button>
          </div>
          <div className="fleet-map-legend">
            <span className="legend-dot legend-healthy" />
            <span className="legend-label">{t("fleet-map.legend.healthy")}</span>
            <span className="legend-dot legend-degraded" />
            <span className="legend-label">{t("fleet-map.legend.degraded")}</span>
            <span className="legend-dot legend-unavailable" />
            <span className="legend-label">{t("fleet-map.legend.unavailable")}</span>
          </div>
        </div>
      </header>

      <PageObservability meta={data?.meta as any} />

      {/* ── Summary Cards ─────────────────────────────────────── */}
      {data && (
        <div className="fleet-summary-strip">
          <div className="fleet-summary-card">
            <span className="fsc-icon">◎</span>
            <span className="fsc-value">{summary.targets}</span>
            <span className="fsc-label">{t("fleet-map.summary.targets")}</span>
          </div>
          <div className="fleet-summary-card">
            <span className="fsc-icon">⬡</span>
            <span className="fsc-value">{summary.workspaces}</span>
            <span className="fsc-label">{t("fleet-map.summary.workspaces")}</span>
          </div>
          <div className="fleet-summary-card">
            <span className="fsc-icon">◈</span>
            <span className="fsc-value">{summary.agents}</span>
            <span className="fsc-label">{t("fleet-map.summary.agents")}</span>
          </div>
          <div className="fleet-summary-card fsc-positive">
            <span className="fsc-icon">✦</span>
            <span className="fsc-value">{summary.fresh}</span>
            <span className="fsc-label">{t("fleet-map.summary.freshness")}</span>
          </div>
          <div className={`fleet-summary-card${summary.warnings > 0 ? " fsc-warning" : ""}`}>
            <span className="fsc-icon">⚑</span>
            <span className="fsc-value">{summary.warnings}</span>
            <span className="fsc-label">{t("fleet-map.summary.warnings")}</span>
          </div>
        </div>
      )}

      <DataState loading={loading} error={error} onRetry={retry}>
        {data && positioned.length === 0 ? (
          <div className="state-box">
            <p className="state-title">{t("fleet-map.canvas.empty")}</p>
            <p className="state-message">{t("fleet-map.canvas.emptyHint")}</p>
          </div>
        ) : data ? (
          <div className="fleet-map-canvas-layout">
            {/* ── Topology Canvas ──────────────────────── */}
            <div className="fleet-map-canvas-wrap panel">
              {/* Layer labels */}
              <div className="fleet-map-layers" style={{ height: `${svgHeight}px` }}>
                {(["target", "workspace", "agent"] as const).map((layer) => (
                  <div
                    key={layer}
                    className="fleet-map-layer-label"
                    style={{ top: `${(LAYER_Y[layer] ?? 0) + NODE_H / 2 - 10}px` }}
                  >
                    {t(`fleet-map.layer.${layer}`)}
                  </div>
                ))}
              </div>

              <div className="fleet-map-canvas-scroll">
                <svg
                  ref={svgRef}
                  width={svgWidth}
                  height={svgHeight}
                  viewBox={`${-svgWidth / 2} 0 ${svgWidth} ${svgHeight}`}
                  className="fleet-map-svg"
                  onClick={() => setSelectedId(null)}
                >
                  <defs>
                    <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L0,6 L6,3 z" className="edge-arrow" />
                    </marker>
                  </defs>

                  {/* Edges */}
                  <g className="edges">
                    {edges.map((edge, i) => {
                      const from = posMap[edge.fromId];
                      const to = posMap[edge.toId];
                      if (!from || !to) return null;
                      const isHighlighted = selectedId === edge.fromId || selectedId === edge.toId;
                      return (
                        <path
                          key={`edge-${i}`}
                          d={edgePath(from, to)}
                          className={`fleet-edge${isHighlighted ? " fleet-edge--highlight" : ""}`}
                          markerEnd="url(#arrow)"
                        />
                      );
                    })}
                  </g>

                  {/* Nodes */}
                  <g className="nodes">
                    {positioned.map((node) => {
                      const isSelected = selectedId === node.id;
                      return (
                        <g
                          key={node.id}
                          className={`topology-node topology-node--${node.health}${isSelected ? " topology-node--selected" : ""}`}
                          transform={`translate(${node.x}, ${node.y})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(isSelected ? null : node.id);
                          }}
                          style={{ cursor: "pointer" }}
                          role="button"
                          tabIndex={0}
                          aria-selected={isSelected}
                        >
                          {/* Card background */}
                          <rect
                            x={0}
                            y={0}
                            width={NODE_W}
                            height={NODE_H}
                            rx={8}
                            className="node-rect"
                          />
                          {/* Status accent bar */}
                          <rect x={0} y={0} width={4} height={NODE_H} rx={2} className="node-accent" />

                          {/* Icon */}
                          <text x={18} y={30} className="node-icon">
                            {getIcon(node.nodeType)}
                          </text>

                          {/* Label */}
                          <foreignObject x={32} y={8} width={112} height={36}>
                            <div
                              // @ts-expect-error - xmlns required for foreignObject
                              xmlns="http://www.w3.org/1999/xhtml"
                              className="node-label-fo"
                            >
                              <span className="node-label-text" title={node.label}>{node.label}</span>
                              {viewMode === "governance" ? (
                                <div className="node-governance-pills">
                                  {node.details?.["freshness"] && (
                                    <span className="node-gov-pill node-gov-pill--freshness" title="Freshness">
                                      {String(node.details["freshness"])}
                                    </span>
                                  )}
                                  {(Number(node.details?.["warningCount"]) > 0) && (
                                    <span className="node-gov-pill node-gov-pill--warning" title="Warnings">
                                      ⚠ {node.details?.["warningCount"]}
                                    </span>
                                  )}
                                  {(Number(node.details?.["riskCount"]) > 0) && (
                                    <span className="node-gov-pill node-gov-pill--risk" title="Risks">
                                      ⚑ {node.details?.["riskCount"]}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="node-type-badge">{translateNodeType(node.nodeType)}</span>
                              )}
                            </div>
                          </foreignObject>

                          {/* Status dot (top-right) */}
                          <circle
                            cx={NODE_W - 8}
                            cy={8}
                            r={5}
                            className={`node-status-dot node-status-dot--${node.health}`}
                          />
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
            </div>

            {/* ── Inspector Panel ──────────────────────── */}
            <aside className={`fleet-inspector panel${selectedNode ? " fleet-inspector--active" : ""}`}>
              <div className="fleet-inspector-header">
                <h3>{t("fleet-map.inspector.title")}</h3>
              </div>

              {selectedNode ? (
                <div className="fleet-inspector-body">
                  <div className="inspector-node-icon">{getIcon(selectedNode.nodeType)}</div>
                  <div className="inspector-node-label">{selectedNode.label}</div>

                  <dl className="inspector-dl">
                    <dt>{t("fleet-map.inspector.type")}</dt>
                    <dd>{translateNodeType(selectedNode.nodeType)}</dd>

                    <dt>{t("fleet-map.inspector.status")}</dt>
                    <dd>
                      <span className={`inspector-status-badge inspector-status--${selectedNode.health}`}>
                        {translateStatus(selectedNode.status)}
                      </span>
                      {selectedNode.health === "unavailable" && (
                        <p className="inspector-hint">{t("fleet-map.inspector.unavailableHint")}</p>
                      )}
                      {selectedNode.health === "unknown" && (
                        <p className="inspector-hint">{t("fleet-map.inspector.unknownHint")}</p>
                      )}
                    </dd>

                    <dt>{t("fleet-map.inspector.id")}</dt>
                    <dd className="inspector-id">{selectedNode.id}</dd>

                    {selectedNode.details && Object.entries(selectedNode.details).length > 0 && (
                      <>
                        <dt>{t("fleet-map.inspector.details")}</dt>
                        <dd>
                          <div className="inspector-details-grid">
                            {Object.entries(selectedNode.details).map(([k, v]) => (
                              <div key={k} className="inspector-detail-row">
                                <span className="inspector-detail-key">{k}</span>
                                <span className="inspector-detail-val">{String(v ?? "—")}</span>
                              </div>
                            ))}
                          </div>
                        </dd>
                      </>
                    )}

                    {associatedNodes.length > 0 && (
                      <>
                        <dt>{t("fleet-map.inspector.associated")}</dt>
                        <dd>
                          <div className="inspector-associated-list">
                            {associatedNodes.map(assoc => (
                              <div key={assoc.id} className="inspector-associated-item">
                                <span className="assoc-icon">{getIcon(assoc.nodeType)}</span>
                                <span className="assoc-label" title={assoc.label}>{assoc.label}</span>
                                <StatusBadge status={getHealth(assoc.status)} />
                              </div>
                            ))}
                          </div>
                        </dd>
                      </>
                    )}
                  </dl>

                  {drillDownPath && (
                    <button
                      type="button"
                      className="btn-primary inspector-drilldown"
                      onClick={() => navigate(drillDownPath)}
                    >
                      {t("fleet-map.inspector.drillDown")} →
                    </button>
                  )}
                </div>
              ) : (
                <div className="fleet-inspector-empty">
                  <div className="inspector-empty-icon">⬡</div>
                  <p className="inspector-empty-title">{t("fleet-map.inspector.noSelection")}</p>
                  <p className="inspector-empty-hint">{t("fleet-map.inspector.noSelectionHint")}</p>
                </div>
              )}
            </aside>
          </div>
        ) : null}
      </DataState>
    </section>
  );
}
