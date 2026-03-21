import { useI18n } from "../../lib/i18n.js";

export function EmptyPanel({
  title,
  message,
  tone = "neutral",
}: {
  title: string;
  message: string;
  tone?: "neutral" | "warning";
}) {
  const { t } = useI18n();

  return (
    <div className={`state-box${tone === "warning" ? " state-box-warning" : ""} panel-empty-state`}>
      <p className="state-title">{title}</p>
      <p className="state-message">{message}</p>
      <p className="panel-empty-footnote">{t("state.emptyPanelFootnote")}</p>
    </div>
  );
}
