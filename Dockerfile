# syntax=docker/dockerfile:1

# The exact Node.js release, the same as .nvmrc.
ARG NODE_VERSION=26.13.0

FROM node:${NODE_VERSION}-slim AS base
RUN npm install -g pnpm@11.22.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod

FROM node:${NODE_VERSION}-slim
ENV NODE_ENV=production \
    LOUPE_PORT=3000 \
    LOUPE_DATA_DIR=/data
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY drizzle ./drizzle
COPY src/server ./src/server
COPY src/shared ./src/shared
RUN mkdir /data && chown node:node /data \
    && printf '#!/bin/sh\nexec node /app/src/server/cli.ts "$@"\n' > /usr/local/bin/loupe \
    && chmod +x /usr/local/bin/loupe
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.LOUPE_PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "src/server/index.ts"]
