import { FilesystemOpenClawAdapter, type FilesystemOpenClawAdapterOptions } from "./filesystem/filesystem-adapter.js";
import { MockOpenClawAdapter, type MockAdapterScenario } from "./mock/mock-adapter.js";
import type { SidecarInventoryAdapter } from "./source-adapter.js";

export interface SidecarAdapterEnvironment {
  SIDECAR_MOCK_SCENARIO?: string;
  OPENCLAW_RUNTIME_ROOT?: string;
  OPENCLAW_STATE_DIR?: string;
  OPENCLAW_CONFIG_FILE?: string;
  OPENCLAW_CONFIG_PATH?: string;
  OPENCLAW_WORKSPACE_GLOB?: string;
  OPENCLAW_LOG_GLOB?: string;
  OPENCLAW_GATEWAY_URL?: string;
  OPENCLAW_GATEWAY_TOKEN?: string;
  OPENCLAW_SOURCE_ROOT?: string;
  OPENCLAW_PROFILE?: string;
}

const EXAMPLE_PLACEHOLDER_MARKERS = ["/path/to/your", "\\path\\to\\your"] as const;

function normalizeAdapterEnvironmentValue(value?: string): string | undefined {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  if (EXAMPLE_PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))) {
    return undefined;
  }

  return normalized;
}

export function hasFilesystemAdapterConfiguration(environment: SidecarAdapterEnvironment): boolean {
  return [
    environment.OPENCLAW_RUNTIME_ROOT,
    environment.OPENCLAW_STATE_DIR,
    environment.OPENCLAW_CONFIG_FILE,
    environment.OPENCLAW_CONFIG_PATH,
    environment.OPENCLAW_WORKSPACE_GLOB,
    environment.OPENCLAW_LOG_GLOB,
    environment.OPENCLAW_GATEWAY_URL,
    environment.OPENCLAW_PROFILE,
  ].some((value) => Boolean(normalizeAdapterEnvironmentValue(value)));
}

export function createSidecarAdapterFromEnv(
  environment: SidecarAdapterEnvironment = process.env,
): SidecarInventoryAdapter {
  if (hasFilesystemAdapterConfiguration(environment)) {
    const options: FilesystemOpenClawAdapterOptions = {
      runtimeRoot: normalizeAdapterEnvironmentValue(environment.OPENCLAW_RUNTIME_ROOT),
      stateDir: normalizeAdapterEnvironmentValue(environment.OPENCLAW_STATE_DIR),
      configFile: normalizeAdapterEnvironmentValue(environment.OPENCLAW_CONFIG_FILE),
      configPath: normalizeAdapterEnvironmentValue(environment.OPENCLAW_CONFIG_PATH),
      workspaceGlob: normalizeAdapterEnvironmentValue(environment.OPENCLAW_WORKSPACE_GLOB),
      logGlob: normalizeAdapterEnvironmentValue(environment.OPENCLAW_LOG_GLOB),
      gatewayUrl: normalizeAdapterEnvironmentValue(environment.OPENCLAW_GATEWAY_URL),
      gatewayToken: normalizeAdapterEnvironmentValue(environment.OPENCLAW_GATEWAY_TOKEN),
      sourceRoot: normalizeAdapterEnvironmentValue(environment.OPENCLAW_SOURCE_ROOT),
      profile: normalizeAdapterEnvironmentValue(environment.OPENCLAW_PROFILE),
    };
    return new FilesystemOpenClawAdapter(options);
  }

  const scenario = environment.SIDECAR_MOCK_SCENARIO;
  return new MockOpenClawAdapter(
    scenario ? { scenario: scenario as MockAdapterScenario } : undefined,
  );
}
