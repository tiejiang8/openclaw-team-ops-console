export interface BootstrapWarningDto {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  remediation?: string;
}

export interface BootstrapStatusDto {
  mode: "mock" | "filesystem" | "target-registry";
  stateDirResolved?: string;
  configFileResolved?: string;
  workspaceResolved?: string;
  gatewayUrlResolved?: string;
  gatewayReachable: boolean;
  gatewayAuthMode: "none" | "explicit" | "auto-from-openclaw-json";
  operatorReadReady: boolean;
  warnings: BootstrapWarningDto[];
  freshness: "hot" | "warm" | "stale";
  checkedAt: string;
}

export interface BootstrapStatusResponse {
  data: BootstrapStatusDto;
  meta: {
    generatedAt: string;
    readOnly: boolean;
    source?: string;
  };
}
