import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BootstrapStatusDto, BootstrapWarningDto } from "@openclaw-team-ops/shared";
import type { SidecarInventoryAdapter } from "../adapters/source-adapter.js";

async function checkExists(p: string | undefined): Promise<boolean> {
  if (!p) return false;
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export class BootstrapStatusService {
  constructor(private readonly adapter: SidecarInventoryAdapter) {}

  async getStatus(): Promise<BootstrapStatusDto> {
    const env = process.env;
    const mode = this.adapter.mode === "mock" ? "mock" : "filesystem";
    const warnings: BootstrapWarningDto[] = [];

    let stateDirResolved: string | undefined;
    let configFileResolved: string | undefined;
    let workspaceResolved: string | undefined;
    let gatewayUrlResolved: string | undefined;
    let gatewayReachable = false;
    let gatewayAuthMode: "none" | "explicit" | "auto-from-openclaw-json" = "none";
    let operatorReadReady = false;

    if (mode === "filesystem") {
      stateDirResolved = this.adapter.getStateDir();
      configFileResolved = this.adapter.getConfigFile();
      workspaceResolved = this.adapter.getWorkspaceGlob();
      gatewayUrlResolved = this.adapter.getGatewayUrl();

      const stateDirExists = await checkExists(stateDirResolved);
      if (stateDirResolved && !stateDirExists) {
        warnings.push({
          code: "STATE_DIR_MISSING",
          message: `State directory not found at ${stateDirResolved}`,
          severity: "error",
          remediation: "Check OPENCLAW_STATE_DIR or OPENCLAW_RUNTIME_ROOT environment variables.",
        });
      }

      const configFileExists = await checkExists(configFileResolved);
      if (configFileResolved && !configFileExists) {
        warnings.push({
          code: "CONFIG_FILE_MISSING",
          message: `Config file not found at ${configFileResolved}`,
          severity: "warning",
          remediation: "Ensure openclaw.json exists in the state directory or set OPENCLAW_CONFIG_FILE.",
        });
      }

      const dataPlaneHealthy = await this.adapter.isDataPlaneHealthy();

      const gatewayUrlForProbe = gatewayUrlResolved
        ? gatewayUrlResolved.startsWith("ws://")
          ? gatewayUrlResolved.replace("ws://", "http://")
          : gatewayUrlResolved.startsWith("wss://")
            ? gatewayUrlResolved.replace("wss://", "https://")
            : gatewayUrlResolved
        : undefined;

      if (gatewayUrlForProbe) {
        gatewayAuthMode = env.OPENCLAW_GATEWAY_TOKEN ? "explicit" : "auto-from-openclaw-json";
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          const response = await fetch(gatewayUrlForProbe, { signal: controller.signal, method: "HEAD" }).catch(
            () => null,
          );
          clearTimeout(timeoutId);
          gatewayReachable = !!response && response.ok;
        } catch {
          gatewayReachable = false;
        }

        if (!gatewayReachable && !dataPlaneHealthy) {
          warnings.push({
            code: "GATEWAY_UNREACHABLE",
            message: `Gateway at ${gatewayUrlResolved} is not reachable via ${gatewayUrlForProbe}`,
            severity: "warning",
            remediation: "Check if the OpenClaw gateway is running and accessible.",
          });
        }
      }

      operatorReadReady = !!stateDirResolved && stateDirExists && (dataPlaneHealthy || !gatewayUrlResolved || gatewayReachable);

      return {
        mode,
        stateDirResolved,
        configFileResolved,
        workspaceResolved,
        gatewayUrlResolved,
        gatewayReachable,
        gatewayAuthMode,
        dataPlaneHealthy,
        operatorReadReady,
        warnings,
        freshness: "hot",
        checkedAt: new Date().toISOString(),
      };
    } else {
      // Mock mode
      return {
        mode,
        gatewayReachable: true,
        gatewayAuthMode: "none",
        dataPlaneHealthy: true,
        operatorReadReady: true,
        warnings: [],
        freshness: "hot",
        checkedAt: new Date().toISOString(),
      };
    }
  }
}
