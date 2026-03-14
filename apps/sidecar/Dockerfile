FROM node:22-alpine AS build

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @openclaw-team-ops/shared build && pnpm --filter @openclaw-team-ops/sidecar build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV SIDECAR_PORT=4310
ENV SIDECAR_MOCK_SCENARIO=baseline

COPY --from=build /workspace/package.json /workspace/pnpm-lock.yaml /workspace/pnpm-workspace.yaml /workspace/tsconfig.base.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/apps/sidecar ./apps/sidecar

WORKDIR /app/apps/sidecar
EXPOSE 4310

CMD ["node", "dist/main.js"]
