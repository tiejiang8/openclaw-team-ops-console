export function MetricHelpPopover({
  label = "?",
  text,
}: {
  label?: string;
  text: string;
}) {
  return (
    <span className="metric-help-popover" role="note" tabIndex={0} title={text} aria-label={text}>
      {label}
    </span>
  );
}
