import type { LogFile } from "@openclaw-team-ops/shared";

import { useI18n } from "../../lib/i18n.js";

export function LogFileSelector({
  value,
  files,
  onChange,
}: {
  value: string;
  files: LogFile[];
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();

  return (
    <label className="log-filter-field">
      <span className="log-filter-label">{t("logs.filters.date")}</span>
      <select className="filter-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="latest">{t("logs.filter.latest")}</option>
        {files.map((file) => (
          <option key={file.date} value={file.date}>
            {file.date}
          </option>
        ))}
      </select>
    </label>
  );
}
