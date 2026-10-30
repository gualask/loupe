# syntax=docker/dockerfile:1

# The exact Node.js release, the same as .nvmrc.
ARG NODE_VERSION=26.13.0

# Every dependency is plain JavaScript, so the build stages run on the build machine's platform
# and their output is the same for every target: a multi-platform build never runs them under
# emulation.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-slim AS base
RUN npm install -g pnpm@11.22.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
# The release workflow type-checks before building the image.
RUN pnpm build:assets

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod \
    && mkdir /data

FROM node:${NODE_VERSION}-slim
# npm is not needed at run time; removing it keeps its bundled packages out of vulnerability scans.
# This is the only command of the final stage that runs on the target platform.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
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
COPY --from=prod-deps --chown=node:node /data /data
COPY --chmod=755 <<'EOF' /usr/local/bin/loupe
#!/bin/sh
exec node /app/src/server/cli.ts "$@"
EOF
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
    CMD node -e "fetch('http://127.0.0.1:' + process.env.LOUPE_PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "src/server/index.ts"]
