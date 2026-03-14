import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const nodeArguments = process.argv.slice(2);
const rootEnvPath = resolve(process.cwd(), "../../.env");
const command = existsSync(rootEnvPath)
  ? [process.execPath, "--env-file", rootEnvPath, ...nodeArguments]
  : [process.execPath, ...nodeArguments];

const child = spawn(command[0], command.slice(1), {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
