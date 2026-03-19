import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { PageObservability } from "../components/page-observability.js";
import { SignalBadge } from "../components/signal-badge.js";
import { overlayApi } from "../lib/api.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";

export function RecommendationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, translateRecommendationType } = useI18n();

  const loadData = useCallback(async () => {
    if (!id) throw new Error("Recommendation ID is required");
    
    const recResponse = await overlayApi.getRecommendation(id);
    const rec = recResponse.data;
    
    // Fetch associated finding
    const findingResponse = await overlayApi.getFinding(rec.findingId);
    
    return {
      recommendation: rec,
      finding: findingResponse.data,
      meta: recResponse.meta,
    };
  }, [id]);

  const { data, loading, error, retry } = useResource(`recommendation:${id}`, loadData);

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <Link to="/recommendations" className="back-link">
          {t("recommendationDetail.back")}
        </Link>
        <h2>{data?.recommendation.title ?? t("recommendationDetail.title")}</h2>
        <p>{t("recommendationDetail.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard label={t("recommendations.table.priority")} value={<SignalBadge value={data.recommendation.priority} />} />
              <MetricCard label={t("recommendations.table.type")} value={translateRecommendationType(data.recommendation.type)} />
              <MetricCard label={t("recommendationDetail.safetyTitle")} value={data.recommendation.safetyLevel} />
              <MetricCard label={t("recommendationDetail.findingTitle")} value={
                <Link className="inline-link" to={`/findings/${data.finding.id}`}>View Finding</Link>
              } />
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("recommendationDetail.description")}</h3>
              </div>
              <div className="panel-content">
                <p style={{ fontSize: "1.1rem", lineHeight: "1.6" }}>{data.recommendation.body}</p>
              </div>
            </div>

            <div className="detail-grid">
              {data.recommendation.commandTemplate && (
                <div className="panel">
                  <div className="panel-header">
                    <h3>{t("recommendationDetail.commandTitle")}</h3>
                  </div>
                  <pre className="recommendation-command">
                    <code>{data.recommendation.commandTemplate}</code>
                  </pre>
                </div>
              )}

              {data.recommendation.pathHint && (
                <div className="panel">
                  <div className="panel-header">
                    <h3>{t("recommendationDetail.pathTitle")}</h3>
                  </div>
                  <p className="cell-mono" style={{ padding: "1rem" }}>{data.recommendation.pathHint}</p>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("recommendationDetail.findingTitle")}</h3>
              </div>
              <div className="panel-content">
                <div className="cell-title">{data.finding.summary}</div>
                <div className="cell-subtitle">{data.finding.id}</div>
                <div style={{ marginTop: "1rem" }}>
                  <Link to={`/findings/${data.finding.id}`} className="button button-outline">
                    Go to Finding Detail
                  </Link>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DataState>
    </section>
  );
}
