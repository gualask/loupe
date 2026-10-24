# Development

## Requirements

- Node.js 24 or newer
- pnpm 11

## Setup

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts three processes: the Hono server on port 3000, Vite on port 5173 and the bridge
build in watch mode. Open `http://localhost:5173`; Vite forwards API and mockup requests to the
server. Local data is stored in `./data`.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Run the app in development mode |
| `pnpm build` | Type-check and build the web app and the bridge into `dist/` |
| `pnpm start` | Run the production server from the working tree, after `pnpm build` |
| `pnpm test` | Run the tests (Vitest) |
| `pnpm lint` | Check formatting and lint rules (Biome); `pnpm format` fixes formatting |
| `pnpm typecheck` | Type-check the whole project |
| `pnpm knip` | Find unused files, exports and dependencies |
| `pnpm db:generate` | Generate a migration after changing the database schema |
| `docker build -t loupe .` | Build the production image |

## Releases

Pushing a version tag runs `.github/workflows/release.yml`: the same checks as above, then a
multi-platform image (`linux/amd64`, `linux/arm64`) published to
`ghcr.io/gualask/loupe`. Nothing runs on branch pushes.

1. Move the `[Unreleased]` entries of `CHANGELOG.md` into the new version and commit.
2. Tag and push: `git tag v0.1.0 && git push origin v0.1.0`.

A stable version (`v1.2.3`) is tagged `1.2.3`, `1.2` and `latest`; a pre-release
(`v1.2.3-rc.1`) only gets its own tag. The first published image is private on GitHub: make the
package public once in its settings.

## Project layout and conventions

Code layout, coding rules, security invariants and the changelog policy are described in
[`AGENTS.md`](../AGENTS.md), which applies to human contributors and coding agents alike. Product
behavior and architecture are in [`SPEC.md`](SPEC.md).
