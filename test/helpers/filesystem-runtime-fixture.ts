import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface FilesystemRuntimeFixture {
  rootDir: string;
  runtimeRoot: string;
  configFile: string;
  workspaceGlob: string;
  sourceRoot: string;
  cleanup(): Promise<void>;
}

export async function createFilesystemRuntimeFixture(): Promise<FilesystemRuntimeFixture> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-ops-fs-"));
  const runtimeRoot = path.join(rootDir, "runtime");
  const sourceRoot = path.join(rootDir, "openclaw-source");
  const workspaceMain = path.join(runtimeRoot, "workspace-main");
  const workspaceOps = path.join(runtimeRoot, "workspace-ops");
  const configFile = path.join(runtimeRoot, "openclaw.json");

  await mkdir(path.join(runtimeRoot, "agents", "main", "agent"), { recursive: true });
  await mkdir(path.join(runtimeRoot, "agents", "main", "sessions"), { recursive: true });
  await mkdir(path.join(runtimeRoot, "agents", "ops", "agent"), { recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(path.join(workspaceMain, "memory"), { recursive: true });
  await mkdir(path.join(workspaceMain, "skills"), { recursive: true });

  await writeFile(
    configFile,
    `{
      agents: { $include: "./agents.json5" },
      bindings: [
        { agentId: "main", match: { channel: "discord", accountId: "default" } },
        { agentId: "ops", match: { channel: "slack", accountId: "*" } },
      ],
    }
`,
  );
  await writeFile(
    path.join(runtimeRoot, "agents.json5"),
    `{
      defaults: {
        workspace: "./workspace-main",
      },
      list: [
        {
          id: "main",
          default: true,
          name: "Main Agent",
          workspace: "./workspace-main",
        },
        {
          id: "ops",
          name: "Ops Agent",
          workspace: "./workspace-ops",
        },
      ],
    }
`,
  );
  await writeFile(path.join(workspaceMain, "AGENTS.md"), "# Main workspace\n");
  await writeFile(path.join(workspaceMain, "BOOTSTRAP.md"), "# Main bootstrap\n");
  await writeFile(path.join(workspaceMain, "IDENTITY.md"), "# Main identity\n");
  await writeFile(path.join(workspaceMain, "SOUL.md"), "# Main persona\n");
  await writeFile(path.join(workspaceMain, "TOOLS.md"), "# Main tools\n");
  await writeFile(path.join(workspaceMain, "USER.md"), "# Main user\n");
  await writeFile(path.join(workspaceMain, "memory", "2026-03-14.md"), "Memory entry\n");
  await writeFile(
    path.join(runtimeRoot, "agents", "main", "agent", "auth-profiles.json"),
    JSON.stringify(
      {
        profiles: {
          "anthropic:default": {
            provider: "anthropic",
            mode: "token",
          },
        },
        usageStats: {
          "anthropic:default": {
            lastUsed: 1760000000000,
          },
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(runtimeRoot, "agents", "main", "sessions", "sessions.json"),
    JSON.stringify(
      {
        "agent:main:discord:channel:ops": {
          sessionId: "discord-ops-thread",
          updatedAt: "2026-03-14T08:30:00.000Z",
          provider: "discord",
        },
      },
      null,
      2,
    ),
  );
  await writeFile(path.join(sourceRoot, "README.md"), "# OpenClaw source root\n");

  return {
    rootDir,
    runtimeRoot,
    configFile,
    workspaceGlob: path.join(runtimeRoot, "workspace*"),
    sourceRoot,
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
}
