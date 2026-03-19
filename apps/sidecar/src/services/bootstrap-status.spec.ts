import { describe, it, expect, vi, beforeEach } from "vitest";
import { BootstrapStatusService } from "./bootstrap-status.js";
import { stat } from "node:fs/promises";

vi.mock("node:fs/promises");

describe("BootstrapStatusService", () => {
  const mockAdapter = {
    mode: "mock",
    getStateDir: vi.fn(),
    getConfigFile: vi.fn(),
    getWorkspaceGlob: vi.fn(),
    getGatewayUrl: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  it("should report healthy status in mock mode", async () => {
    mockAdapter.mode = "mock";
    const service = new BootstrapStatusService(mockAdapter);
    const status = await service.getStatus();

    expect(status.mode).toBe("mock");
    expect(status.operatorReadReady).toBe(true);
    expect(status.warnings).toHaveLength(0);
  });

  it("should report warnings when state directory is missing in filesystem mode", async () => {
    mockAdapter.mode = "external-readonly";
    mockAdapter.getStateDir.mockReturnValue("/missing/dir");
    (stat as any).mockRejectedValue(new Error("ENOENT"));

    const service = new BootstrapStatusService(mockAdapter);
    const status = await service.getStatus();

    expect(status.mode).toBe("filesystem");
    expect(status.operatorReadReady).toBe(false);
    expect(status.warnings.some((w: any) => w.code === "STATE_DIR_MISSING")).toBe(true);
  });

  it("should report warnings when config file is missing", async () => {
    mockAdapter.mode = "external-readonly";
    mockAdapter.getStateDir.mockReturnValue("/exists");
    mockAdapter.getConfigFile.mockReturnValue("/missing/config.yaml");
    (stat as any).mockImplementation((p: string) => {
      if (p === "/exists") return Promise.resolve({});
      return Promise.reject(new Error("ENOENT"));
    });

    const service = new BootstrapStatusService(mockAdapter);
    const status = await service.getStatus();

    expect(status.warnings.some((w: any) => w.code === "CONFIG_FILE_MISSING")).toBe(true);
  });

  it("should report gateway unreachable when fetch fails", async () => {
    mockAdapter.mode = "external-readonly";
    mockAdapter.getGatewayUrl.mockReturnValue("http://failed-gateway");
    mockAdapter.isDataPlaneHealthy.mockResolvedValue(false);
    
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connect timeout")));

    const service = new BootstrapStatusService(mockAdapter);
    const status = await service.getStatus();

    expect(status.gatewayReachable).toBe(false);
    expect(status.warnings.some((w: any) => w.code === "GATEWAY_UNREACHABLE")).toBe(true);
  });

  it("should convert ws:// to http:// for probing", async () => {
    mockAdapter.mode = "external-readonly";
    mockAdapter.getGatewayUrl.mockReturnValue("ws://my-gateway");
    
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const service = new BootstrapStatusService(mockAdapter);
    await service.getStatus();

    expect(mockFetch).toHaveBeenCalledWith("http://my-gateway", expect.any(Object));
  });

  it("should convert wss:// to https:// for probing", async () => {
    mockAdapter.mode = "external-readonly";
    mockAdapter.getGatewayUrl.mockReturnValue("wss://my-gateway");
    
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    const service = new BootstrapStatusService(mockAdapter);
    await service.getStatus();

    expect(mockFetch).toHaveBeenCalledWith("https://my-gateway", expect.any(Object));
  });

  it("should be ready when data plane is healthy even if gateway probe fails", async () => {
    mockAdapter.mode = "external-readonly";
    mockAdapter.getStateDir.mockReturnValue("/exists");
    mockAdapter.getGatewayUrl.mockReturnValue("http://failed-gateway");
    mockAdapter.isDataPlaneHealthy.mockResolvedValue(true);
    
    (stat as any).mockResolvedValue({ isDirectory: () => true });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Failed")));

    const service = new BootstrapStatusService(mockAdapter);
    const status = await service.getStatus();

    expect(status.gatewayReachable).toBe(false);
    expect(status.dataPlaneHealthy).toBe(true);
    expect(status.operatorReadReady).toBe(true);
    expect(status.warnings.some((w: any) => w.code === "GATEWAY_UNREACHABLE")).toBe(false);
  });
});
