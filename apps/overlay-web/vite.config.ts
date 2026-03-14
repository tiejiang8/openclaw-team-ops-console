import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../../", "");
  const overlayWebPort = Number(env.OVERLAY_WEB_PORT ?? 5173);
  const overlayApiProxyTarget = env.OVERLAY_API_PROXY_TARGET ?? "http://127.0.0.1:4300";

  return {
    envDir: "../../",
    plugins: [react()],
    server: {
      port: overlayWebPort,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: overlayApiProxyTarget,
          changeOrigin: true,
        },
        "/health": {
          target: overlayApiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: overlayWebPort,
      host: "0.0.0.0",
    },
  };
});
