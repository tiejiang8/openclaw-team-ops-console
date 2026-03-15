import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";

import { DataState } from "../components/data-state.js";
import { MetricCard } from "../components/metric-card.js";
import { PageObservability } from "../components/page-observability.js";
import { SignalBadge } from "../components/signal-badge.js";
import { overlayApi } from "../lib/api.js";
import { formatDetailEntries, resourcePathForSubject } from "../lib/governance.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { useResource } from "../lib/use-resource.js";

export function EvidenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    language,
    t,
    translateEvidenceKind,
    translateEvidenceSubjectType,
    translateFreshness,
  } = useI18n();

  const loadEvidence = useCallback(async () => {
    if (!id) {
      throw new Error("Evidence id is required.");
    }

    const evidenceResponse = await overlayApi.getEvidence(id);
    return {
      evidence: evidenceResponse.data,
      meta: evidenceResponse.meta,
    };
  }, [id]);

  const { data, loading, error, retry } = useResource(`evidence:${id ?? "missing"}`, loadEvidence);

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <Link to="/evidence" className="back-link">
          {t("evidenceDetail.back")}
        </Link>
        <h2>{data?.evidence.message ?? t("evidenceDetail.title")}</h2>
        <p>{t("evidenceDetail.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <>
            <div className="metrics-grid">
              <MetricCard label={t("evidence.table.kind")} value={translateEvidenceKind(data.evidence.kind)} />
              <MetricCard label={t("evidence.table.severity")} value={<SignalBadge value={data.evidence.severity} />} />
              <MetricCard label={t("evidence.table.freshness")} value={translateFreshness(data.evidence.freshness)} />
              <MetricCard label={t("evidence.table.observed")} value={formatTimestamp(data.evidence.observedAt, language)} />
            </div>

            <div className="detail-grid">
              <div className="panel">
                <div className="panel-header">
                  <h3>{t("evidenceDetail.detailsTitle")}</h3>
                  <p>{data.evidence.id}</p>
                </div>

                <dl className="detail-list">
                  <div className="detail-list-row">
                    <dt>{t("evidence.table.target")}</dt>
                    <dd>
                      <Link className="inline-link" to={`/targets/${data.evidence.targetId}`}>
                        {data.evidence.targetName ?? data.evidence.targetId}
                      </Link>
                    </dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>{t("evidence.table.subject")}</dt>
                    <dd>
                      {translateEvidenceSubjectType(data.evidence.subjectType)} · {data.evidence.subjectLabel ?? data.evidence.subjectId}
                    </dd>
                  </div>
                </dl>

                <div className="detail-chips">
                  {formatDetailEntries(data.evidence.details).map((entry) => (
                    <span key={entry} className="detail-chip">
                      {entry}
                    </span>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h3>{t("evidenceDetail.resourceTitle")}</h3>
                  <p>{t("common.openResource")}</p>
                </div>

                <p>
                  <Link
                    className="inline-link"
                    to={resourcePathForSubject(data.evidence.targetId, data.evidence.subjectType, data.evidence.subjectId)}
                  >
                    {t("common.openResource")}
                  </Link>
                </p>

                <div className="detail-list">
                  <div className="detail-list-row">
                    <dt>{t("evidenceDetail.pathRefsTitle")}</dt>
                    <dd>{data.evidence.pathRefs?.length ? data.evidence.pathRefs.join(" | ") : "-"}</dd>
                  </div>
                  <div className="detail-list-row">
                    <dt>{t("evidenceDetail.fieldRefsTitle")}</dt>
                    <dd>{data.evidence.fieldRefs?.length ? data.evidence.fieldRefs.join(" | ") : "-"}</dd>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </DataState>
    </section>
  );
}
