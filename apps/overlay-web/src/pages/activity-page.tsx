import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { DataState } from "../components/data-state.js";
import { PageObservability } from "../components/page-observability.js";
import { overlayApi } from "../lib/api.js";
import { formatTimestamp } from "../lib/format.js";
import { useI18n } from "../lib/i18n.js";
import { useStreamRefresh } from "../components/streaming-provider.js";
import { useResource } from "../lib/use-resource.js";
import type { ActivityEventDto } from "@openclaw-team-ops/shared";

type ActivityTypeFilter = "all" | "cron" | "node" | "session" | "log";

export function ActivityPage() {
  const { language, t } = useI18n();
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const loadActivity = useCallback(async () => {
    return overlayApi.getActivity({
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
      ...(severityFilter !== "all" ? { severity: severityFilter } : {}),
    });
  }, [typeFilter, severityFilter]);

  const { data, loading, error, retry } = useResource(
    `activity-${typeFilter}-${severityFilter}`,
    loadActivity,
    { refreshIntervalMs: 10000 }
  );

  useStreamRefresh("activity", retry);

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case "info": return t("activity.severity.info");
      case "warn": return t("activity.severity.warn");
      case "error": return t("activity.severity.error");
      case "critical": return t("activity.severity.critical");
      default: return severity;
    }
  };

  const getSubjectLink = (event: ActivityEventDto) => {
    if (!event.subjectId) return null;
    switch (event.subjectType) {
      case "cron-job": return `/cron/${event.subjectId}`;
      case "session": return `/sessions/${event.subjectId}`;
      case "node": return `/nodes`;
      case "finding": return `/findings/${event.subjectId}`;
      default: return null;
    }
  };

  return (
    <section className="page fade-in-up">
      <header className="page-header">
        <h2>{t("activity.title")}</h2>
        <p>{t("activity.description")}</p>
      </header>

      <PageObservability meta={data?.meta} />

      <div className="filter-row filter-row-spread">
        <div className="filter-group">
          <select 
            className="filter-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ActivityTypeFilter)}
          >
            <option value="all">{t("activity.filter.all")}</option>
            <option value="cron">{t("activity.filter.cron")}</option>
            <option value="node">{t("activity.filter.node")}</option>
            <option value="session">{t("activity.filter.session")}</option>
            <option value="log">{t("activity.filter.log")}</option>
          </select>

          <select
            className="filter-input"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="info">{t("activity.severity.info")}</option>
            <option value="warn">{t("activity.severity.warn")}</option>
            <option value="error">{t("activity.severity.error")}</option>
            <option value="critical">{t("activity.severity.critical")}</option>
          </select>
        </div>
      </div>

      <DataState loading={loading} error={error} onRetry={retry}>
        {data ? (
          <div className="timeline">
            {data.data.length === 0 ? (
              <div className="state-box">
                <p className="state-message">{t("activity.empty")}</p>
              </div>
            ) : (
              data.data.map((event: ActivityEventDto) => {
                const link = getSubjectLink(event);
                return (
                  <div key={event.id} className="timeline-item" data-severity={event.severity}>
                    <div className="timeline-marker"></div>
                    <div className="timeline-content panel">
                      <div className="event-header">
                        <span className="event-time">{formatTimestamp(event.timestamp, language)}</span>
                        <span className="event-type-badge" data-type={event.type}>{event.type}</span>
                        <span className="severity-badge" data-severity={event.severity}>
                          {getSeverityLabel(event.severity)}
                        </span>
                      </div>
                      <div className="event-body">
                        <p className="event-message">{event.message}</p>
                        {link && (
                          <Link to={link} className="event-link">
                            View Details
                          </Link>
                        )}
                      </div>
                      {event.details && (
                        <div className="event-details">
                          {Object.entries(event.details).map(([key, value]) => (
                            <span key={key} className="detail-pill">{key}: {String(value)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </DataState>
    </section>
  );
}
