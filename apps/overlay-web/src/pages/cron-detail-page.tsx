import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import { DataState } from "../components/data-state.js";
import { PageObservability } from "../components/page-observability.js";
import { StatusBadge } from "../components/status-badge.js";
import { getCronJob } from "../lib/api/cron.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { useRefreshPreferences } from "../lib/refresh-preferences.js";
import { useResource } from "../lib/use-resource.js";

export function CronDetailPage() {
  const { id = "" } = useParams();
  const { language, t } = useI18n();
  const { intervalMs, autoRefreshEnabled } = useRefreshPreferences();
  const loadCronJob = useMemo(() => () => getCronJob(id), [id]);
  const { data, loading, error, retry } = useResource(`cron-detail:${id}`, loadCronJob, {
    refreshIntervalMs: intervalMs,
    autoRefreshEnabled,
  });
  const job = data?.data;

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("cron.detailTitle")}</h2>
        <p>{job?.name ?? id}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <DataState
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={!loading && !error && !job}
        emptyTitle={t("cron.emptyTitle")}
        emptyMessage={t("cron.emptyMessage")}
      >
        {job ? (
          <>
            <Link to="/cron" className="detail-link">
              {t("cron.backToList")}
            </Link>

            <div className="detail-grid">
              <article className="panel">
                <div className="panel-header">
                  <h3>{t("cron.detailOverview")}</h3>
                </div>

                <dl className="detail-list">
                  <div>
                    <dt>{t("cron.table.schedule")}</dt>
                    <dd className="cell-mono">{job.scheduleText}</dd>
                  </div>
                  <div>
                    <dt>{t("cron.table.status")}</dt>
                    <dd><StatusBadge status={job.overdue ? "degraded" : job.lastRunState ?? "unknown"} /></dd>
                  </div>
                  <div>
                    <dt>{t("cron.table.nextRun")}</dt>
                    <dd>{formatTimestamp(job.nextRunAt, language)}</dd>
                  </div>
                  <div>
                    <dt>{t("cron.table.lastRun")}</dt>
                    <dd>{formatTimestamp(job.lastRunAt, language)}</dd>
                  </div>
                  <div>
                    <dt>{t("cron.detailRawPath")}</dt>
                    <dd className="cell-mono">{job.rawPath ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>{t("cron.detailRunLogPath")}</dt>
                    <dd className="cell-mono">{job.rawRunLogPath ?? "-"}</dd>
                  </div>
                </dl>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h3>{t("cron.detailRuns")}</h3>
                </div>
                <div className="table-wrap">
                  <table className="data-table density-comfortable">
                    <thead>
                      <tr>
                        <th>{t("cron.detailRunId")}</th>
                        <th>{t("cron.detailStartedAt")}</th>
                        <th>{t("cron.detailFinishedAt")}</th>
                        <th>{t("cron.table.status")}</th>
                        <th>{t("cron.detailSummary")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.recentRuns.map((run, index) => (
                        <tr key={run.runId ?? `${job.id}-${index}`}>
                          <td className="cell-mono">{run.runId ?? "-"}</td>
                          <td>{formatTimestamp(run.startedAt, language)}</td>
                          <td>{formatTimestamp(run.finishedAt, language)}</td>
                          <td><StatusBadge status={run.state} /></td>
                          <td>{run.summary ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>

            <div className="detail-grid">
              <article className="panel">
                <div className="panel-header">
                  <h3>{t("cron.detailWarnings")}</h3>
                </div>
                <ul className="detail-list-inline">
                  {job.warnings.length > 0 ? job.warnings.map((warning) => <li key={warning}>{warning}</li>) : <li>{t("cron.detailNone")}</li>}
                </ul>
              </article>

              <article className="panel">
                <div className="panel-header">
                  <h3>{t("cron.detailEvidence")}</h3>
                </div>
                <ul className="detail-list-inline">
                  {job.evidenceRefs.map((ref) => (
                    <li key={`${ref.kind}:${ref.value}`}>{ref.kind}: {ref.value}</li>
                  ))}
                </ul>
              </article>
            </div>
          </>
        ) : null}
      </DataState>
    </section>
  );
}
