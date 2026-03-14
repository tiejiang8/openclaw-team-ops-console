import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

if (process.platform !== "linux") {
  process.exit(0);
}

const repoRoot = process.cwd();
const playwrightCacheDir = path.join(homedir(), ".cache", "ms-playwright");
const debCacheDir = path.join(repoRoot, ".cache", "e2e-debs");
const extractDir = path.join(repoRoot, ".cache", "playwright-system-libs");
const linuxLibDir = path.join(extractDir, "usr", "lib", "x86_64-linux-gnu");
const preparedLibraryChecks = {
  libnspr4: [path.join(linuxLibDir, "libnspr4.so")],
  libnss3: [path.join(linuxLibDir, "libnss3.so"), path.join(linuxLibDir, "libnssutil3.so")],
  libasound2: [path.join(linuxLibDir, "libasound.so.2"), path.join(linuxLibDir, "libasound.so.2.0.0")],
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error(stderr || stdout || `Command failed: ${command} ${args.join(" ")}`);
  }

  return result.stdout ?? "";
}

function findChromiumBinary() {
  if (!existsSync(playwrightCacheDir)) {
    return undefined;
  }

  const entries = readdirSync(playwrightCacheDir)
    .filter((entry) => entry.startsWith("chromium_headless_shell-"))
    .sort()
    .reverse();

  for (const entry of entries) {
    const candidate = path.join(
      playwrightCacheDir,
      entry,
      "chrome-headless-shell-linux64",
      "chrome-headless-shell",
    );

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function collectMissingPackages(lddOutput) {
  const missingPackages = new Set();

  if (lddOutput.includes("libnspr4.so => not found")) {
    missingPackages.add("libnspr4");
  }

  if (lddOutput.includes("libnss3.so => not found") || lddOutput.includes("libnssutil3.so => not found")) {
    missingPackages.add("libnss3");
  }

  if (lddOutput.includes("libasound.so.2 => not found")) {
    missingPackages.add("libasound2");
  }

  return [...missingPackages];
}

function ensureDir(directory) {
  mkdirSync(directory, { recursive: true });
}

function isPrepared(packageName) {
  const candidates = preparedLibraryChecks[packageName] ?? [];
  if (packageName === "libasound2") {
    return candidates.some((candidate) => existsSync(candidate));
  }

  return candidates.every((candidate) => existsSync(candidate));
}

const chromiumBinary = findChromiumBinary();

if (!chromiumBinary) {
  console.log("[prepare-playwright-linux-libs] Playwright Chromium binary not found yet; skipping.");
  process.exit(0);
}

const lddOutput = run("ldd", [chromiumBinary]);
const missingPackages = collectMissingPackages(lddOutput);

if (missingPackages.length === 0) {
  console.log("[prepare-playwright-linux-libs] No extra Linux libraries needed.");
  process.exit(0);
}

if (missingPackages.every((packageName) => isPrepared(packageName))) {
  console.log(`[prepare-playwright-linux-libs] Reusing prepared local library directory at ${linuxLibDir}`);
  process.exit(0);
}

if (!existsSync("/usr/bin/apt") || !existsSync("/usr/bin/dpkg-deb")) {
  throw new Error(
    "Missing required tools (`apt` and `dpkg-deb`) to prepare Playwright Linux libraries without sudo.",
  );
}

ensureDir(debCacheDir);
ensureDir(extractDir);

console.log(`[prepare-playwright-linux-libs] Fetching packages: ${missingPackages.join(", ")}`);
run("apt", ["download", ...missingPackages], { cwd: debCacheDir });

const debFiles = readdirSync(debCacheDir)
  .filter((entry) => entry.endsWith(".deb"))
  .map((entry) => path.join(debCacheDir, entry));

for (const debFile of debFiles) {
  run("dpkg-deb", ["-x", debFile, extractDir]);
}

if (!existsSync(linuxLibDir)) {
  throw new Error("Expected extracted Playwright Linux library directory was not created.");
}

console.log(`[prepare-playwright-linux-libs] Prepared local library directory at ${linuxLibDir}`);
