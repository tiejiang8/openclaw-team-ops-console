import { existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

import { createOverlayApiApp } from "../../apps/overlay-api/src/app.js";
import { SidecarClient } from "../../apps/overlay-api/src/clients/sidecar-client.js";
import { createSidecarApp } from "../../apps/sidecar/src/app.js";
import { MockOpenClawAdapter, type MockAdapterScenario } from "../../apps/sidecar/src/adapters/mock/mock-adapter.js";

export interface GovernanceBrowserFixture {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  webUrl: string;
  apiUrl: string;
  sidecarUrl: string;
  scenario: MockAdapterScenario;
}

interface StartedServer {
  url: string;
  close: () => Promise<void>;
}

interface ListenTarget {
  listen: (
    port: number,
    host: string,
    callback: () => void,
  ) => {
    address: () => AddressInfo | string | null;
    close: (callback: (error?: Error | null) => void) => void;
    once: (event: "error", handler: (error: Error) => void) => void;
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const webDistDir = path.join(repoRoot, "apps/overlay-web/dist");
const webIndexHtml = path.join(webDistDir, "index.html");
const playwrightLinuxLibDir = path.join(repoRoot, ".cache/playwright-system-libs/usr/lib/x86_64-linux-gnu");

async function startServer(app: ListenTarget): Promise<StartedServer> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Expected an AddressInfo listener result."));
        return;
      }

      resolve({
        url: `http://127.0.0.1:${(address as AddressInfo).port}`,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }

              closeResolve();
            });
          }),
      });
    });

    server.once("error", reject);
  });
}

async function ensureWebBuildExists() {
  try {
    await access(webIndexHtml);
  } catch {
    throw new Error(
      "overlay-web build output was not found. Run `corepack pnpm build` before `corepack pnpm test:e2e`.",
    );
  }
}

async function proxyReadRequest(apiBaseUrl: string, requestUrl: string, acceptHeader: string | undefined, response: ServerResponse) {
  const upstreamResponse = await fetch(`${apiBaseUrl}${requestUrl}`, {
    headers: {
      accept: acceptHeader ?? "*/*",
    },
  });

  response.statusCode = upstreamResponse.status;

  const contentType = upstreamResponse.headers.get("content-type");
  const readOnly = upstreamResponse.headers.get("x-openclaw-ops-readonly");

  if (contentType) {
    response.setHeader("content-type", contentType);
  }

  if (readOnly) {
    response.setHeader("x-openclaw-ops-readonly", readOnly);
  }

  const body = Buffer.from(await upstreamResponse.arrayBuffer());
  response.end(body);
}

function contentTypeForPath(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();

  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

async function sendStaticAsset(response: ServerResponse, requestPath: string) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const absolutePath = path.resolve(webDistDir, `.${normalizedPath}`);
  const relativePath = path.relative(webDistDir, absolutePath);

  if (relativePath.startsWith("..")) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }

  try {
    const fileBuffer = await readFile(absolutePath);
    response.statusCode = 200;
    response.setHeader("content-type", contentTypeForPath(absolutePath));
    response.end(fileBuffer);
  } catch {
    const indexBuffer = await readFile(webIndexHtml);
    response.statusCode = 200;
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(indexBuffer);
  }
}

function createOverlayWebFixtureServer(apiBaseUrl: string): ListenTarget {
  const server = createHttpServer(async (request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = request.url ?? "/";

    try {
      if (request.method !== "GET") {
        response.statusCode = 405;
        response.end("Method Not Allowed");
        return;
      }

      if (requestUrl === "/health" || requestUrl.startsWith("/api/")) {
        await proxyReadRequest(apiBaseUrl, requestUrl, request.headers.accept, response);
        return;
      }

      const url = new URL(requestUrl, "http://127.0.0.1");
      await sendStaticAsset(response, url.pathname);
    } catch (error) {
      response.statusCode = 502;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.end(error instanceof Error ? error.message : "Unknown E2E web fixture error");
    }
  });

  return {
    listen: (port, host, callback) => server.listen(port, host, callback),
  };
}

export async function withGovernanceBrowserFixture<T>(
  scenario: MockAdapterScenario,
  run: (fixture: GovernanceBrowserFixture) => Promise<T>,
): Promise<T> {
  await ensureWebBuildExists();

  const launchEnvironment =
    process.platform === "linux" && pathExists(playwrightLinuxLibDir)
      ? {
          ...process.env,
          LD_LIBRARY_PATH: [playwrightLinuxLibDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
        }
      : process.env;

  const sidecar = await startServer(createSidecarApp(new MockOpenClawAdapter({ scenario })));
  const api = await startServer(
    createOverlayApiApp(
      new SidecarClient({
        baseUrl: sidecar.url,
        timeoutMs: 5000,
      }),
    ),
  );
  const web = await startServer(createOverlayWebFixtureServer(api.url));
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    env: launchEnvironment,
  });
  const context = await browser.newContext({
    locale: "en-US",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    return await run({
      browser,
      context,
      page,
      webUrl: web.url,
      apiUrl: api.url,
      sidecarUrl: sidecar.url,
      scenario,
    });
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    await web.close();
    await api.close();
    await sidecar.close();
  }
}

function pathExists(targetPath: string) {
  try {
    return existsSync(targetPath);
  } catch {
    return false;
  }
}
