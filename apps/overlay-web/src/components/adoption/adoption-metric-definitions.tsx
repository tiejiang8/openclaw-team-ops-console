import { useI18n } from "../../lib/i18n.js";
import { MetricConfidenceBadge, type MetricConfidenceTone } from "../metric/metric-confidence-badge.js";

interface MetricDefinition {
  id: string;
  title: string;
  tone: Extract<MetricConfidenceTone, "proxy" | "observational" | "snapshot">;
  description: string;
  formula: string;
  readAs: string;
}

export function AdoptionMetricDefinitions() {
  const { t } = useI18n();

  const definitions: MetricDefinition[] = [
    {
      id: "metric-active-users-proxy",
      title: t("adoption.kpi.activeUsersProxy"),
      tone: "proxy",
      description: t("adoption.help.activeUsersProxy"),
      formula: t("adoption.definition.activeUsersProxy.formula"),
      readAs: t("adoption.definition.activeUsersProxy.readAs"),
    },
    {
      id: "metric-sessions-today",
      title: t("adoption.kpi.sessionsToday"),
      tone: "snapshot",
      description: t("adoption.help.sessionsToday"),
      formula: t("adoption.definition.sessionsToday.formula"),
      readAs: t("adoption.definition.sessionsToday.readAs"),
    },
    {
      id: "metric-turns-today",
      title: t("adoption.kpi.turnsToday"),
      tone: "observational",
      description: t("adoption.help.turnsToday"),
      formula: t("adoption.definition.turnsToday.formula"),
      readAs: t("adoption.definition.turnsToday.readAs"),
    },
    {
      id: "metric-avg-duration",
      title: t("adoption.kpi.avgDuration"),
      tone: "observational",
      description: t("adoption.help.avgDuration"),
      formula: t("adoption.definition.avgDuration.formula"),
      readAs: t("adoption.definition.avgDuration.readAs"),
    },
    {
      id: "metric-retention-proxy",
      title: t("adoption.retentionTitle"),
      tone: "proxy",
      description: t("adoption.help.retention"),
      formula: t("adoption.definition.retention.formula"),
      readAs: t("adoption.definition.retention.readAs"),
    },
  ];

  return (
    <article className="panel" id="adoption-metric-definitions">
      <div className="panel-header">
        <div>
          <h3>{t("adoption.definitionsTitle")}</h3>
          <p>{t("adoption.definitionsDescription")}</p>
        </div>
      </div>

      <div className="metric-definition-grid">
        {definitions.map((definition) => (
          <section key={definition.id} id={definition.id} className="metric-definition-card">
            <div className="metric-definition-header">
              <h4>{definition.title}</h4>
              <MetricConfidenceBadge tone={definition.tone} />
            </div>
            <p className="metric-definition-description">{definition.description}</p>
            <dl className="metric-definition-list">
              <div>
                <dt>{t("adoption.definition.formulaLabel")}</dt>
                <dd>{definition.formula}</dd>
              </div>
              <div>
                <dt>{t("adoption.definition.readAsLabel")}</dt>
                <dd>{definition.readAs}</dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
    </article>
  );
}
