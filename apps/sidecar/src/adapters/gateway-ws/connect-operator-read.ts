import { GATEWAY_OPERATOR_ROLE, GATEWAY_READONLY_SCOPES, type GatewayRequestClient } from "./protocol.js";

interface ConnectOperatorReadOptions {
  authToken?: string;
}

export async function connectOperatorRead(
  client: GatewayRequestClient,
  options: ConnectOperatorReadOptions = {},
): Promise<void> {
  await client.request("connect", {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: "openclaw-team-ops-console",
      displayName: "OpenClaw Team Ops Console",
      version: "0.2.0-alpha.0",
      platform: process.platform,
      mode: "ui",
      instanceId: "openclaw-team-ops-console-sidecar",
    },
    locale: "en-US",
    userAgent: "openclaw-team-ops-console-sidecar",
    role: GATEWAY_OPERATOR_ROLE,
    scopes: [...GATEWAY_READONLY_SCOPES],
    caps: [],
    ...(options.authToken ? { auth: { token: options.authToken } } : {}),
  });
}
