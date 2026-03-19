import type { FindingSeverity, SnapshotWarningSeverity, TopologyNodeType } from "../domain.js";

export type FleetMapNodeType = TopologyNodeType | "target" | "cron-job" | "finding";

export interface FleetMapNode {
  id: string;
  nodeType: FleetMapNodeType;
  label: string;
  status: string;
  workspaceId?: string;
  targetId?: string;
  severity?: FindingSeverity | SnapshotWarningSeverity | undefined;
  details?: Record<string, string | number | boolean | null>;
}

export interface FleetMapEdge {
  fromType: FleetMapNodeType;
  fromId: string;
  toType: FleetMapNodeType;
  toId: string;
  relation: string;
}

export interface FleetMapDto {
  generatedAt: string;
  nodes: FleetMapNode[];
  edges: FleetMapEdge[];
}


export interface FleetMapResponse {
  data: FleetMapDto;
  meta: {
    generatedAt: string;
    readOnly: boolean;
  };
}
