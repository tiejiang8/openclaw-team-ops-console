import { useI18n } from "../../lib/i18n.js";
import { useRefreshPreferences, type RefreshMode } from "../../lib/refresh-preferences.js";

const refreshModes: RefreshMode[] = ["off", "30s", "3m"];

export function RefreshModePicker() {
  const { t } = useI18n();
  const { mode, setMode, autoRefreshEnabled } = useRefreshPreferences();

  return (
    <section className="language-switcher refresh-mode-picker" aria-label={t("refresh.label")}>
      <p className="language-switcher-label" style={{ margin: 0, fontSize: "0.68rem" }}>
        {t("refresh.label")}
      </p>
      <div className="refresh-mode-actions">
        {refreshModes.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            className={`refresh-mode-button${mode === value ? " refresh-mode-button-active" : ""}`}
            onClick={() => setMode(value)}
          >
            {t(`refresh.${value}`)}
          </button>
        ))}
      </div>
      <p className="refresh-mode-help">{autoRefreshEnabled ? t("refresh.staleNotice") : t("refresh.manualOnly")}</p>
    </section>
  );
}
