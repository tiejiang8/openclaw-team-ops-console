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
      // OpenClaw validates client.id against a fixed enum, so keep a
      // recognized backend id and surface Team Ops identity via displayName.
      id: "gateway-client",
      displayName: "OpenClaw Team Ops Console",
      version: "0.2.0-alpha.0",
      platform: process.platform,
      mode: "backend",
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
