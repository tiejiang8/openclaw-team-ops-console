import type { BootstrapStatusDto } from "@openclaw-team-ops/shared";
import { StatusBadge } from "../status-badge.js";
import { useI18n } from "../../lib/i18n.js";
import { formatTimestamp } from "../../lib/format.js";

interface ConnectionChecklistProps {
  status: BootstrapStatusDto;
}

export function ConnectionChecklist({ status }: ConnectionChecklistProps) {
  const { t, language } = useI18n();

  const getStatusIcon = (ready: boolean) => (ready ? "✅" : "❌");

  return (
    <div className="panel connection-checklist fade-in">
      <div className="panel-header">
        <h3>{t("bootstrap.title")}</h3>
        <p>{t("bootstrap.description")}</p>
      </div>

      <div className="checklist-grid">
        <div className="checklist-item">
          <span className="checklist-label">{t("bootstrap.mode")}</span>
          <span className="checklist-value">
            <StatusBadge status={status.mode} />
          </span>
        </div>

        {status.stateDirResolved && (
          <div className="checklist-item">
            <span className="checklist-label">{t("bootstrap.stateDir")}</span>
            <span className="checklist-value cell-mono">{status.stateDirResolved}</span>
          </div>
        )}

        {status.configFileResolved && (
          <div className="checklist-item">
            <span className="checklist-label">{t("bootstrap.configFile")}</span>
            <span className="checklist-value cell-mono">{status.configFileResolved}</span>
          </div>
        )}

        <div className="checklist-item">
          <span className="checklist-label">{t("runtime.gateway")}</span>
          <span className="checklist-value">
            {getStatusIcon(status.dataPlaneHealthy || status.gatewayReachable)} {status.gatewayUrlResolved || "N/A"}
          </span>
        </div>

        <div className="checklist-item">
          <span className="checklist-label">{t("runtime.transportProbe")}</span>
          <span className="checklist-value">
            <StatusBadge status={status.gatewayReachable ? "connected" : "disconnected"} />
          </span>
        </div>

        <div className="checklist-item">
          <span className="checklist-label">{t("runtime.dataReaderHealth")}</span>
          <span className="checklist-value">
            <StatusBadge status={status.dataPlaneHealthy ? "healthy" : "unavailable"} />
          </span>
        </div>

        <div className="checklist-item">
          <span className="checklist-label">{t("bootstrap.ready")}</span>
          <span className="checklist-value">
            <StatusBadge status={status.operatorReadReady ? "healthy" : "unavailable"} />
          </span>
        </div>

        <div className="checklist-item">
          <span className="checklist-label">{t("bootstrap.checkedAt")}</span>
          <span className="checklist-value">{formatTimestamp(status.checkedAt, language)}</span>
        </div>
      </div>

      {status.warnings.filter(w => w.severity !== "info").length > 0 && (
        <div className="checklist-warnings">
          {status.warnings
            .filter(warning => warning.severity !== "info") // Filter out info-level warnings
            .map((warning, index) => (
              <div key={index} className={`alert alert-${warning.severity}`}>
                <div className="alert-content">
                  <strong>{warning.code}: </strong>
                  {warning.message}
                  {warning.remediation && (
                    <div className="alert-remediation">
                      <em>{t("bootstrap.validationSteps")}: </em> {warning.remediation}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}