import { isRecord, toBoolean, toIsoDate, toString, type GatewayRequestClient } from "../gateway-ws/protocol.js";

export interface GatewayStatusProbe {
  rpcHealthy: boolean;
  openclawHealthy?: boolean;
  warnings: string[];
}

export interface GatewayIdentityProbe {
  name?: string;
  version?: string;
}

export async function fetchGatewayStatus(client: GatewayRequestClient): Promise<GatewayStatusProbe> {
  const raw = await client.request("status");
  return normalizeGatewayStatus(raw);
}

export async function fetchGatewayIdentity(client: GatewayRequestClient): Promise<GatewayIdentityProbe> {
  const raw = await client.request("gateway.identity.get");
  return normalizeGatewayIdentity(raw);
}

export function normalizeGatewayStatus(raw: unknown): GatewayStatusProbe {
  if (!isRecord(raw)) {
    return {
      rpcHealthy: true,
      warnings: [],
    };
  }

  const warnings = extractWarnings(raw);
  const explicitHealthy =
    toBoolean(raw.healthy) ??
    (toString(raw.status)?.toLowerCase() === "healthy" ? true : undefined) ??
    (toString(raw.state)?.toLowerCase() === "ok" ? true : undefined);
  const openclawHealthy = toBoolean(raw.openclawHealthy) ?? toBoolean(raw.runtimeHealthy);

  return {
    rpcHealthy: explicitHealthy ?? true,
    ...(typeof openclawHealthy === "boolean" ? { openclawHealthy } : {}),
    warnings,
  };
}

export function normalizeGatewayIdentity(raw: unknown): GatewayIdentityProbe {
  if (!isRecord(raw)) {
    return {};
  }

  const name = toString(raw.name) ?? toString(raw.displayName);
  const version = toString(raw.version) ?? (isRecord(raw.runtime) ? toString(raw.runtime.version) : undefined);

  return {
    ...(name ? { name } : {}),
    ...(version ? { version } : {}),
  };
}

export function extractWarningTimestamp(raw: unknown): string | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  return toIsoDate(raw.updatedAt) ?? toIsoDate(raw.lastSeenAt) ?? toIsoDate(raw.ts);
}

function extractWarnings(raw: Record<string, unknown>): string[] {
  const values = [];

  if (typeof raw.warning === "string") {
    values.push(raw.warning);
  }

  if (Array.isArray(raw.warnings)) {
    for (const warning of raw.warnings) {
      if (typeof warning === "string") {
        values.push(warning);
      } else if (isRecord(warning)) {
        const message = toString(warning.message) ?? toString(warning.code);
        if (message) {
          values.push(message);
        }
      }
    }
  }

  return values;
}
