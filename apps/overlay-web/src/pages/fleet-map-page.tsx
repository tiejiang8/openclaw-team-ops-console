import { useCallback, useMemo } from "react";
import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { PageObservability } from "../components/page-observability.js";
import { overlayApi } from "../lib/api.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";
import type { FleetMapNode } from "@openclaw-team-ops/shared";

export function FleetMapPage() {
  const { t, translateNodeType } = useI18n();

  const loadFleetMap = useCallback(async () => {
    return overlayApi.getFleetMap();
  }, []);

  const { data, loading, error, retry } = useResource("fleet-map", loadFleetMap);

  const stats = useMemo(() => {
    if (!data) return { nodes: 0, edges: 0, findings: 0 };
    return {
      nodes: data.data.nodes.length,
      edges: data.data.edges.length,
      findings: data.data.nodes.filter((n: FleetMapNode) => n.nodeType === "finding").length,
    };
  }, [data]);

  // Group nodes by target for a clustered view
  const targetClusters = useMemo(() => {
    if (!data) return [];
    
    const targets = data.data.nodes.filter((n: FleetMapNode) => n.nodeType === "target");
    const others = data.data.nodes.filter((n: FleetMapNode) => n.nodeType !== "target");
    
    return targets.map((target: FleetMapNode) => {
       const clusterNodes = others.filter((n: FleetMapNode) => n.targetId === target.targetId || (n.nodeType === "finding" && n.details?.targetId === target.targetId));
       return {
          target,
          nodes: clusterNodes,
       };
    });
  }, [data]);

  const orphanedNodes = useMemo(() => {
     if (!data) return [];
     return data.data.nodes.filter((n: FleetMapNode) => n.nodeType !== "target" && !n.targetId);
  }, [data]);

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("fleet-map.title")}</h2>
        <p>{t("fleet-map.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard label={t("fleetMap.metric.nodes")} value={stats.nodes} />
              <MetricCard label={t("fleetMap.metric.edges")} value={stats.edges} />
              <MetricCard label={t("fleetMap.metric.findings")} value={stats.findings} />
            </div>

            <div className="fleet-map-container">
               {targetClusters.map((cluster: { target: FleetMapNode; nodes: FleetMapNode[] }) => (
                  <div key={cluster.target.id} className="panel target-cluster">
                     <div className="panel-header">
                        <div className="status-badge" data-status={cluster.target.status}></div>
                        <h3>{cluster.target.label}</h3>
                        <span className="badge">{t("fleetMap.nodeType.target")}</span>
                     </div>
                     <div className="cluster-content">
                        {cluster.nodes.map((node: FleetMapNode) => (
                           <div key={node.id} className="node-card" data-type={node.nodeType} data-severity={node.severity}>
                              <div className="node-type">{translateNodeType(node.nodeType)}</div>
                              <div className="node-label">{node.label}</div>
                              {node.severity && <div className="node-severity">{node.severity}</div>}
                           </div>
                        ))}
                     </div>
                  </div>
               ))}
               
               {orphanedNodes.length > 0 && (
                  <div className="panel target-cluster">
                     <div className="panel-header">
                        <h3>Global Entities</h3>
                     </div>
                     <div className="cluster-content">
                        {orphanedNodes.map((node: FleetMapNode) => (
                           <div key={node.id} className="node-card" data-type={node.nodeType} data-severity={node.severity}>
                              <div className="node-type">{translateNodeType(node.nodeType)}</div>
                              <div className="node-label">{node.label}</div>
                           </div>
                        ))}
                     </div>
                  </div>
               ) }
            </div>
          </>
        ) : null}
      </DataState>
    </section>
  );
}
