import type { EvidenceReference } from "@openclaw-team-ops/shared";
import { Link } from "react-router-dom";

import { useI18n } from "../../lib/i18n.js";

function localizeEvidenceLabel(label: string, language: "en" | "zh") {
  if (language !== "zh") {
    return label;
  }

  const sessionWorkspace = /^Session (.+) has a missing workspace condition\.$/.exec(label);
  if (sessionWorkspace) {
    return `会话 ${sessionWorkspace[1]} 缺少工作区关联条件。`;
  }

  const sessionAgent = /^Session (.+) has a missing agent condition\.$/.exec(label);
  if (sessionAgent) {
    return `会话 ${sessionAgent[1]} 缺少智能体关联条件。`;
  }

  const bindingAgent = /^Binding (.+) has a missing agent condition\.$/.exec(label);
  if (bindingAgent) {
    return `绑定 ${bindingAgent[1]} 缺少智能体关联条件。`;
  }

  const bindingWorkspace = /^Binding (.+) has a missing workspace condition\.$/.exec(label);
  if (bindingWorkspace) {
    return `绑定 ${bindingWorkspace[1]} 缺少工作区关联条件。`;
  }

  return label;
}

export function EvidencePill({ evidence }: { evidence: EvidenceReference }) {
  const { language, translateEvidenceKind } = useI18n();

  return (
    <Link className={`evidence-pill evidence-pill-${evidence.severity}`} to={evidence.to}>
      <span>{translateEvidenceKind(evidence.kind)}</span>
      <span className="evidence-pill-label">{localizeEvidenceLabel(evidence.label, language)}</span>
    </Link>
  );
}
