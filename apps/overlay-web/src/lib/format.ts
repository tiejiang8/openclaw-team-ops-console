import type { LanguageCode } from "./i18n.js";

function toIntlLocale(language: LanguageCode): string {
  return language === "zh" ? "zh-CN" : "en-US";
}

export function formatTimestamp(value?: string | null, language: LanguageCode = "en"): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "-";
  }

  return new Intl.DateTimeFormat(toIntlLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatUptime(seconds?: number | null, language: LanguageCode = "en"): string {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "-";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return language === "zh" ? `${days}天 ${hours}小时` : `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return language === "zh" ? `${hours}小时 ${minutes}分` : `${hours}h ${minutes}m`;
  }

  return language === "zh" ? `${minutes}分` : `${minutes}m`;
}
