# Repository Guidelines

## Project Structure & Module Organization

Loupe is a single Node.js process: a Hono server that exposes the API, serves sandboxed mockup
documents, and serves the Preact web app built by Vite. The product and technical reference is
`docs/SPEC.md`; read it before changing behavior.

- `src/server`: Hono app (`app.ts`), entry point (`index.ts`), maintenance CLI (`cli.ts`),
  configuration (`config.ts`), HTTP routes (`routes/`), accounts and sessions (`auth/`), stored
  mockups and their sandboxing (`mockups/`), share-link reviews and the real-time hub
  (`review/`), and all database access (`db/`: schema, client and one module of query functions
  per table).
- `src/web`: Preact single-page app (`App.tsx` routes, `pages/`, `components/`, `ui/`) and the
  review space behind share links (`viewer/`).
- `src/bridge`: script inlined into every served mockup; runs inside the sandboxed iframe and talks
  to the app only through `postMessage`. Keep it dependency-free and small.
- `src/shared`: Zod schemas and types shared by server, web app and bridge (API payloads, pin
  anchors, bridge protocol). The bridge may import types only.
- `drizzle/`: generated SQL migrations. Never edit them by hand.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies (Node.js ≥ 24, pnpm 11).
- `pnpm dev`: run the bridge watcher, the server (`node --watch`, port 3000) and Vite (port 5173,
  proxying `/api`, `/healthz` and mockup documents to the server). Open `http://localhost:5173`.
- `pnpm build`: type-check, then build the web app (`dist/web`) and the bridge (`dist/bridge`).
- `pnpm start`: run the production server from the working tree (after `pnpm build`).
- `pnpm test`: run Vitest.
- `pnpm lint`: run Biome checks. `pnpm format` writes formatting.
- `pnpm knip`: find unused files, exports and dependencies.
- `pnpm db:generate`: generate a migration after changing `src/server/db/schema.ts`.
- `docker build -t loupe .`: build the production image.

## Coding Style & Boundaries

Let Biome handle formatting. Use PascalCase for Preact components, `use*` for hooks, and
colocate feature helpers with the feature they serve. In the web app write `class`, not
`className`.

Server code runs directly through Node's type stripping, with no build step:

- import local modules with explicit `.ts` extensions;
- use erasable TypeScript only: no `enum`, `namespace`, parameter properties or decorators
  (`erasableSyntaxOnly` enforces this);
- do not use path aliases; Node does not resolve them.

Only server runtime packages belong in `dependencies`; everything bundled by Vite (Preact, icons,
router) is a `devDependency`, so the production image stays small.

## Security Invariants

Uploaded mockups are untrusted HTML. Never serve them from a route without the sandbox CSP
described in `docs/SPEC.md` §4.1, never embed them without `sandbox="allow-scripts"`, and never
add `allow-same-origin`. Comment UI lives in the parent app, never inside the mockup document.
Store secrets (session ids, viewer keys, account tokens) only as SHA-256 hashes.

## Compatibility & Contracts

The project is pre-release. Until the first tagged release, schema changes may replace the
initial migration: delete `drizzle/`, run `pnpm db:generate`, and recreate local data. From the
first release on, every schema change ships as a new generated migration and existing data must
keep working.

### Drizzle release candidate

`drizzle-orm` and `drizzle-kit` are pinned to the exact version `1.0.0-rc.5` because `node:sqlite`
support exists only in the 1.0 line, whose release candidates still ship breaking changes. Until
1.0 is stable:

- Upgrade only deliberately, to an exact version, after reading the release notes.
- Use only the SQL-like query builder (`db.select()`, `insert`, `update`, `delete`). Do not use
  Relational Queries (`db.query.*`, `defineRelations`): that API is still changing between RCs.
  Load nested data with separate queries grouped in TypeScript.
- Keep all database access in functions under `src/server/db/`; routes never import Drizzle
  directly. This confines any future driver or API change to one module.

**When Drizzle 1.0 is stable:** move both packages to the stable release, then revisit these
rules. Consider Relational Queries where they would simplify the multi-query loaders in
`src/server/db/` (for example threads with their comments).

Treat API routes and payloads, SSE event payloads, the bridge `postMessage` protocol, the pin
anchor format and environment variables as contracts. Change the Zod schema in `src/shared`, the
server, the web app and the tests together, and update `docs/SPEC.md` when behavior changes.

## Documentation

`README.md` is user-facing: what Loupe is, features, quick start and an index of the docs. Keep
technical content in `docs/`: `self-hosting.md` (installation and the canonical list of
environment variables), `development.md` (local setup and commands) and `SPEC.md` (behavior and
architecture). Update the relevant file in the same change.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and
[SemVer](https://semver.org/). Changes that affect people running Loupe go under `[Unreleased]`
in the same change, using only the standard sections. Write one short line per entry, describing
the effect rather than the implementation, and update an existing entry instead of adding a
near-duplicate. Leave out refactors, tests, CI and fixes to unreleased work. At release time,
consolidate `[Unreleased]` into the new version; never edit released sections.

## Testing Guidelines

Colocate tests as `*.test.ts` / `*.test.tsx`. Test server routes with `createTestApp()` from
`src/server/test-utils.ts`: an in-memory database with the real migrations and a client that keeps
cookies. Prefer tests that
assert complete response payloads over tests that only check status codes.

Run the narrowest relevant checks, then broaden them in proportion to the change. Before handing
off broad changes run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm knip`.
