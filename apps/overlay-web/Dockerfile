FROM node:22-alpine AS build

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

ARG VITE_OVERLAY_API_URL=
ENV VITE_OVERLAY_API_URL=${VITE_OVERLAY_API_URL}

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @openclaw-team-ops/shared build && pnpm --filter @openclaw-team-ops/overlay-web build

FROM nginx:1.27-alpine AS runtime

COPY apps/overlay-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/overlay-web/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
