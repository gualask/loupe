# syntax=docker/dockerfile:1

# The exact Node.js release, as in .nvmrc: the release workflow checks it, and the runtime image
# below, against that file.
ARG NODE_VERSION=26.13.1

# Every dependency is plain JavaScript, so the build stages run on the build machine's platform
# and their output is the same for every target. The final stage only copies files, so a
# multi-platform build runs nothing under emulation.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-slim AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# The release package.json names in packageManager, a plain `pnpm@<version>`.
RUN npm install -g "$(node -p 'require("./package.json").packageManager')"

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
# The release workflow type-checks before building the image.
RUN pnpm build:assets

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod \
    && mkdir /data

# Distroless: Node.js and the libraries it needs, without a shell or a package manager. Its tag
# names only the major release of Node.js.
FROM gcr.io/distroless/nodejs26-debian13:nonroot
# The image keeps Node.js out of the default PATH.
ENV PATH=/nodejs/bin:$PATH \
    NODE_ENV=production \
    LOUPE_PORT=3000 \
    LOUPE_DATA_DIR=/data
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY drizzle ./drizzle
COPY src/server ./src/server
COPY src/shared ./src/shared
COPY --from=prod-deps --chown=1000:1000 /data /data
# Without a shell, the maintenance command is a Node.js script.
COPY --chmod=755 <<'EOF' /usr/local/bin/loupe
#!/nodejs/bin/node
import('/app/src/server/cli.ts');
EOF
# The ID of the build stages' node user, which owns the volumes of earlier images. By ID:
# Kubernetes' runAsNonRoot can only verify a numeric user.
USER 1000:1000
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.LOUPE_PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# The base image's entry point is node itself: cleared, a command given to `docker run` replaces
# the whole command, as with other images.
ENTRYPOINT []
CMD ["node", "src/server/index.ts"]
