FROM node:22-alpine AS build

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @openclaw-team-ops/shared build && pnpm --filter @openclaw-team-ops/overlay-api build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV OVERLAY_API_PORT=4300
ENV SIDECAR_BASE_URL=http://sidecar:4310
ENV SIDECAR_TIMEOUT_MS=5000

COPY --from=build /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml /workspace/tsconfig.base.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/apps/overlay-api ./apps/overlay-api

WORKDIR /app/apps/overlay-api
EXPOSE 4300

CMD ["node", "dist/main.js"]
