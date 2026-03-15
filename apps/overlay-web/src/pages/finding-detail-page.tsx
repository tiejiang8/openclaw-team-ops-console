import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";

import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { PageObservability } from "../components/page-observability.js";
import { SignalBadge } from "../components/signal-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { resourcePathForSubject } from "../lib/governance.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";

export function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    language,
    t,
    translateEvidenceKind,
    translateEvidenceSubjectType,
    translateFindingType,
    translateRecommendationType,
  } = useI18n();

  const loadFinding = useCallback(async () => {
    if (!id) {
      throw new Error("Finding id is required.");
    }

    const findingResponse = await overlayApi.getFinding(id);
    const finding = findingResponse.data;
    const [evidenceResponses, recommendationsResponse] = await Promise.all([
      Promise.all(finding.evidenceRefs.map((evidenceId) => overlayApi.getEvidence(evidenceId))),
      overlayApi.getRecommendations({ findingId: finding.id }),
    ]);

    return {
      finding,
      evidence: evidenceResponses.map((response) => response.data),
      recommendations: recommendationsResponse.data,
      meta: findingResponse.meta,
    };
  }, [id]);

  const { data, loading, error, retry } = useResource(`finding:${id ?? "missing"}`, loadFinding);

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <Link to="/risks" className="back-link">
          {t("findingDetail.back")}
        </Link>
        <h2>{data?.finding.summary ?? t("findingDetail.title")}</h2>
        <p>{t("findingDetail.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard label={t("risks.table.severity")} value={<SignalBadge value={data.finding.severity} />} />
              <MetricCard label={t("risks.table.type")} value={translateFindingType(data.finding.type)} />
              <MetricCard label={t("findingDetail.score")} value={data.finding.score} />
              <MetricCard label={t("findingDetail.observed")} value={formatTimestamp(data.finding.observedAt, language)} />
            </div>

            <div className="detail-grid">
              <div className="panel">
                <div className="panel-header">
                  <h3>{t("findingDetail.summaryTitle")}</h3>
                  <p>{data.finding.id}</p>
                </div>

                <dl className="detail-list">
                  <div className="detail-list-row">
                    <dt>{t("findingDetail.target")}</dt>
                    <dd>
                      <Link className="inline-link" to={`/targets/${data.finding.targetId}`}>
                        {data.finding.targetName ?? data.finding.targetId}
                      </Link>
                    </dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>{t("findingDetail.subject")}</dt>
                    <dd>
                      {translateEvidenceSubjectType(data.finding.subjectType)} · {data.finding.subjectLabel ?? data.finding.subjectId}
                    </dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>{t("findingDetail.resource")}</dt>
                    <dd>
                      <Link
                        className="inline-link"
                        to={resourcePathForSubject(data.finding.targetId, data.finding.subjectType, data.finding.subjectId)}
                      >
                        {t("common.openResource")}
                      </Link>
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>{t("findingDetail.recommendationsTitle")}</h3>
                  <p>{data.recommendations.length}</p>
                </div>

                <div className="recommendation-list">
                  {data.recommendations.map((recommendation) => (
                    <article key={recommendation.id} className="recommendation-card">
                      <div className="recommendation-header">
                        <div>
                          <div className="cell-title">{recommendation.title}</div>
                          <div className="cell-subtitle">{translateRecommendationType(recommendation.type)}</div>
                        </div>
                        <SignalBadge value={recommendation.priority} />
                      </div>
                      <p className="recommendation-body">{recommendation.body}</p>
                      {recommendation.pathHint ? <p className="cell-mono">{recommendation.pathHint}</p> : null}
                      {recommendation.commandTemplate ? (
                        <pre className="recommendation-command">
                          <code>{recommendation.commandTemplate}</code>
                        </pre>
                      ) : null}
                      {recommendation.docLink ? <p className="cell-subtitle">{recommendation.docLink}</p> : null}
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>{t("findingDetail.evidenceTitle")}</h3>
                <p>{data.evidence.length}</p>
              </div>

              <div className="table-wrap">
                <table className="data-table density-comfortable">
                  <thead>
                    <tr>
                      <th>{t("evidence.table.message")}</th>
                      <th>{t("evidence.table.kind")}</th>
                      <th>{t("evidence.table.severity")}</th>
                      <th>{t("evidence.table.observed")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.evidence.map((evidence) => (
                      <tr key={evidence.id}>
                        <td>
                          <Link to={`/evidence/${evidence.id}`} className="inline-link">
                            <div className="cell-title">{evidence.message}</div>
                          </Link>
                          <div className="cell-subtitle">{evidence.id}</div>
                        </td>
                        <td>{translateEvidenceKind(evidence.kind)}</td>
                        <td>
                          <SignalBadge value={evidence.severity} />
                        </td>
                        <td>{formatTimestamp(evidence.observedAt, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </DataState>
    </section>
  );
}
