import { useI18n } from "../lib/i18n.js";

const classNameByValue: Record<string, string> = {
  info: "signal-badge signal-info",
  warn: "signal-badge signal-warn",
  error: "signal-badge signal-error",
  critical: "signal-badge signal-critical",
  high: "signal-badge signal-high",
  medium: "signal-badge signal-medium",
  low: "signal-badge signal-low",
};

export function SignalBadge({ value }: { value: string }) {
  const { translateSignal } = useI18n();
  const className = classNameByValue[value] ?? "signal-badge signal-neutral";

  return <span className={className}>{translateSignal(value)}</span>;
}
