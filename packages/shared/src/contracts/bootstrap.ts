export interface BootstrapWarningDto {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  remediation?: string;
}

export interface BootstrapStatusDto {
  mode: "mock" | "filesystem" | "target-registry";
  stateDirResolved?: string | undefined;
  configFileResolved?: string | undefined;
  workspaceResolved?: string | undefined;
  gatewayUrlResolved?: string | undefined;
  gatewayReachable: boolean;
  gatewayAuthMode: "none" | "explicit" | "auto-from-openclaw-json";
  dataPlaneHealthy: boolean;
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
