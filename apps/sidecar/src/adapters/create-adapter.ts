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
  OPENCLAW_SOURCE_ROOT?: string;
  OPENCLAW_PROFILE?: string;
}

export function hasFilesystemAdapterConfiguration(environment: SidecarAdapterEnvironment): boolean {
  return [
    environment.OPENCLAW_RUNTIME_ROOT,
    environment.OPENCLAW_STATE_DIR,
    environment.OPENCLAW_CONFIG_FILE,
    environment.OPENCLAW_CONFIG_PATH,
    environment.OPENCLAW_WORKSPACE_GLOB,
    environment.OPENCLAW_PROFILE,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
}

export function createSidecarAdapterFromEnv(
  environment: SidecarAdapterEnvironment = process.env,
): SidecarInventoryAdapter {
  if (hasFilesystemAdapterConfiguration(environment)) {
    const options: FilesystemOpenClawAdapterOptions = {
      runtimeRoot: environment.OPENCLAW_RUNTIME_ROOT,
      stateDir: environment.OPENCLAW_STATE_DIR,
      configFile: environment.OPENCLAW_CONFIG_FILE,
      configPath: environment.OPENCLAW_CONFIG_PATH,
      workspaceGlob: environment.OPENCLAW_WORKSPACE_GLOB,
      sourceRoot: environment.OPENCLAW_SOURCE_ROOT,
      profile: environment.OPENCLAW_PROFILE,
    };
    return new FilesystemOpenClawAdapter(options);
  }

  const scenario = environment.SIDECAR_MOCK_SCENARIO;
  return new MockOpenClawAdapter(
    scenario ? { scenario: scenario as MockAdapterScenario } : undefined,
  );
}
