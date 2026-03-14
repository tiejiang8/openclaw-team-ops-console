import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface FilesystemRuntimeFixtureOptions {
  profile?: string;
  sessionStoreTemplate?: string;
  omitConfigWorkspaceForAgentIds?: string[];
  includeAgentsDefaultWorkspace?: boolean;
  runtimeOnlyAgentIds?: string[];
  includeLegacyMainSessionStore?: boolean;
  includeModernMainSessionStore?: boolean;
}

export interface FilesystemRuntimeFixture {
  rootDir: string;
  homeDir: string;
  runtimeRoot: string;
  configFile: string;
  workspaceGlob: string;
  sourceRoot: string;
  cleanup(): Promise<void>;
}

function resolveFixtureStateDir(rootDir: string, profile: string | undefined): { homeDir: string; runtimeRoot: string } {
  const homeDir = path.join(rootDir, "home");

  if (profile && profile.toLowerCase() !== "default") {
    return {
      homeDir,
      runtimeRoot: path.join(homeDir, `.openclaw-${profile}`),
    };
  }

  return {
    homeDir,
    runtimeRoot: path.join(homeDir, ".openclaw"),
  };
}

function resolveSessionStorePath(configFile: string, template: string | undefined, agentId: string, runtimeRoot: string): string {
  if (!template) {
    return path.join(runtimeRoot, "agents", agentId, "sessions", "sessions.json");
  }

  const interpolated = template.replaceAll("{agentId}", agentId).replaceAll("{{agentId}}", agentId);
  return path.isAbsolute(interpolated) ? interpolated : path.resolve(path.dirname(configFile), interpolated);
}

export async function createFilesystemRuntimeFixture(
  options: FilesystemRuntimeFixtureOptions = {},
): Promise<FilesystemRuntimeFixture> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "openclaw-ops-fs-"));
  const { homeDir, runtimeRoot } = resolveFixtureStateDir(rootDir, options.profile);
  const sourceRoot = path.join(rootDir, "openclaw-source");
  const workspaceMain = path.join(runtimeRoot, "workspace-main");
  const workspaceOps = path.join(runtimeRoot, "workspace-ops");
  const configFile = path.join(runtimeRoot, "openclaw.json");
  const omittedWorkspaceAgents = new Set(options.omitConfigWorkspaceForAgentIds ?? []);
  const runtimeOnlyAgentIds = options.runtimeOnlyAgentIds ?? [];
  const includeAgentsDefaultWorkspace = options.includeAgentsDefaultWorkspace !== false;
  const modernMainSessionStorePath = resolveSessionStorePath(
    configFile,
    options.sessionStoreTemplate,
    "main",
    runtimeRoot,
  );

  await mkdir(homeDir, { recursive: true });
  await mkdir(path.join(runtimeRoot, "agents", "main", "agent"), { recursive: true });
  await mkdir(path.join(runtimeRoot, "agents", "ops", "agent"), { recursive: true });
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(path.join(workspaceMain, "memory"), { recursive: true });
  await mkdir(path.join(workspaceMain, "skills"), { recursive: true });
  await mkdir(path.dirname(modernMainSessionStorePath), { recursive: true });

  for (const runtimeOnlyAgentId of runtimeOnlyAgentIds) {
    await mkdir(path.join(runtimeRoot, "agents", runtimeOnlyAgentId, "agent"), { recursive: true });
    await mkdir(path.join(homeDir, ".openclaw", `workspace-${runtimeOnlyAgentId}`), { recursive: true });
    await writeFile(
      path.join(homeDir, ".openclaw", `workspace-${runtimeOnlyAgentId}`, "AGENTS.md"),
      `# ${runtimeOnlyAgentId} runtime-only workspace\n`,
    );
    await writeFile(
      path.join(homeDir, ".openclaw", `workspace-${runtimeOnlyAgentId}`, "BOOT.md"),
      `# ${runtimeOnlyAgentId} boot instructions\n`,
    );
  }

  await writeFile(
    configFile,
    `{
      agents: { $include: "./agents.json5" },
      ${
        options.sessionStoreTemplate
          ? `session: { store: ${JSON.stringify(options.sessionStoreTemplate)} },`
          : ""
      }
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
      ${
        includeAgentsDefaultWorkspace
          ? `defaults: {
        workspace: "./workspace-main",
      },`
          : ""
      }
      list: [
        {
          id: "main",
          default: true,
          name: "Main Agent",
          ${omittedWorkspaceAgents.has("main") ? "" : 'workspace: "./workspace-main",'}
        },
        {
          id: "ops",
          name: "Ops Agent",
          ${omittedWorkspaceAgents.has("ops") ? "" : 'workspace: "./workspace-ops",'}
        },
      ],
    }
`,
  );
  await writeFile(path.join(workspaceMain, "AGENTS.md"), "# Main workspace\n");
  await writeFile(path.join(workspaceMain, "BOOT.md"), "# Main boot\n");
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

  if (options.includeModernMainSessionStore !== false) {
    await writeFile(
      modernMainSessionStorePath,
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
  }

  if (options.includeLegacyMainSessionStore) {
    await mkdir(path.join(runtimeRoot, "sessions"), { recursive: true });
    await writeFile(
      path.join(runtimeRoot, "sessions", "sessions.json"),
      JSON.stringify(
        {
          "agent:main:legacy:dm:primary": {
            sessionId: "legacy-main-thread",
            updatedAt: "2026-03-13T08:30:00.000Z",
            provider: "legacy",
          },
        },
        null,
        2,
      ),
    );
  }

  await writeFile(path.join(sourceRoot, "README.md"), "# OpenClaw source root\n");

  return {
    rootDir,
    homeDir,
    runtimeRoot,
    configFile,
    workspaceGlob: path.join(runtimeRoot, "workspace*"),
    sourceRoot,
    cleanup: () => rm(rootDir, { recursive: true, force: true }),
  };
}
