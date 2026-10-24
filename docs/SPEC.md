# Loupe — Product & Technical Specification

Loupe is a self-hosted tool for reviewing HTML mockups. An editor uploads a self-contained HTML
file, shares a link, and viewers leave pinned comments on precise elements of the page. Everyone
with the link sees the same shared space in real time.

Status: pre-release. This document describes the MVP and the planned roadmap.

## 1. Roles

| Role | Account | Capabilities |
|---|---|---|
| **Admin** | yes | Everything an editor can do, on every workspace. Invites editors and admins, generates password-reset links, disables accounts. |
| **Editor** | yes | Owns a workspace: creates projects, uploads mockups, manages share links, reads and resolves reviews. Is responsible for the content of the mockups they upload. |
| **Viewer** | no | Anonymous. Reaches a mockup through its share link, places pins, writes comments, submits a review. |

Only admins and editors have accounts. Viewers are identified per browser (see §4.3).

## 2. Domain model

```
User ──owns──▶ Project ──contains──▶ Mockup ──has──▶ MockupVersion
                                       │
                                       ├──▶ Viewer (per-mockup anonymous identity)
                                       ├──▶ Review (one per viewer per version)
                                       └──▶ Thread (pin | general) ──▶ Comment
```

- **Project**: a named container of mockups inside an editor's workspace.
- **Mockup**: a reviewable design with a share link. Holds one or more versions; the MVP exposes
  only one version per mockup, but the schema is version-aware from day one.
- **MockupVersion**: an uploaded HTML file (stored on disk, addressed by SHA-256).
- **Viewer**: an anonymous participant of a single mockup, with display name and color.
- **Review**: the set of a viewer's threads on a version, plus an optional verdict.
- **Thread**: either a **pin** (anchored to a DOM element) or a **general** comment. Has a status
  (`open` / `resolved`).
- **Comment**: a message inside a thread. The first comment is the thread's body; the rest are
  replies from viewers or editors. A deleted comment is blanked but keeps its place; a thread left
  without any visible comment is deleted.

### 2.1 Tables (SQLite)

| Table | Key columns |
|---|---|
| `users` | `id`, `username` (unique), `display_name`, `password_hash`, `role` (`admin`/`editor`), `created_at`, `disabled_at` |
| `sessions` | `id_hash`, `user_id`, `created_at`, `expires_at`, `last_seen_at` |
| `account_tokens` | `id`, `token_hash`, `kind` (`setup`/`invite`/`reset`), `role` (invite), `user_id` (reset), `created_by`, `expires_at`, `used_at` |
| `projects` | `id`, `owner_id`, `name`, `description`, `created_at`, `archived_at` |
| `mockups` | `id`, `project_id`, `name`, `share_token`, `share_enabled`, `share_expires_at`, `read_only`, `current_version_id`, `created_by`, `created_at` |
| `mockup_versions` | `id`, `mockup_id`, `number`, `sha256`, `size_bytes`, `original_filename`, `external_refs` (JSON), `uploaded_by`, `created_at` |
| `viewers` | `id`, `mockup_id`, `key_hash`, `display_name`, `color_index`, `created_at`, `last_seen_at` |
| `reviews` | `id`, `version_id`, `viewer_id`, `status` (`in_progress`/`submitted`), `verdict` (`approved`/`changes_requested`), `summary`, `submitted_at` |
| `threads` | `id`, `version_id`, `kind` (`pin`/`general`), `anchor` (JSON, pins only), `status`, `resolved_by`, `resolved_at`, `author_viewer_id` \| `author_user_id`, `created_at` |
| `comments` | `id`, `thread_id`, `author_viewer_id` \| `author_user_id`, `body`, `created_at`, `edited_at`, `deleted_at` |

IDs are random UUIDs (`crypto.randomUUID()`). Secrets (share tokens, viewer keys, account tokens,
session ids) are 256-bit random values encoded as base64url; only their SHA-256 hash is stored,
except `share_token`, which must be shown again to the editor.

## 3. Authentication (admins & editors)

No email server is required. Every account flow is a **single-use link** that expires.

- **First run**: when the database has no users, the server logs a one-time setup URL
  (`/setup/<token>`, valid 24 h) that creates the first admin. A new link is logged on every
  start until setup is completed.
- **Invite**: an admin creates an invite for a role and copies the link (`/invite/<token>`,
  valid 48 h). The invitee chooses username, display name and password.
- **Password reset**: an admin generates a reset link for a user (`/reset/<token>`, valid 24 h).
  Using it signs the user out of every session.
- **Account management**: admins change roles and disable accounts (which ends their sessions).
  Admins cannot change their own account, so at least one admin always remains.
- **Locked-out admin**: `docker exec loupe loupe reset-link <username>` prints a reset link.
- **Passwords**: `scrypt` from `node:crypto`, minimum 10 characters.
- **Sessions**: opaque id in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` when
  `LOUPE_PUBLIC_URL` is https), stored hashed in SQLite, sliding expiry (default 30 days).
- **CSRF**: Hono `csrf()` middleware (Origin check) on all state-changing routes.
- **Brute force**: in-memory limit of 10 failed logins per username per 15 minutes. Account
  links carry 256-bit secrets and need no limit.
- **Roadmap**: optional SMTP to email invite/reset links (v1.x); OIDC single sign-on (later).

## 4. Mockup viewing

### 4.1 Isolation

Uploaded HTML is untrusted. It is never served as a regular page of the app:

- It is served with `Content-Security-Policy: sandbox allow-scripts` plus a resource policy, and
  embedded in `<iframe sandbox="allow-scripts">`. The document runs in an **opaque origin**: it
  cannot read app cookies, storage, or call the app API, even though everything is on one host.
- Default resource policy (self-contained mode):
  `default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline' data:;
  img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'`.
  This enforces "self-contained" and blocks data exfiltration.
- `LOUPE_MOCKUP_EXTERNAL=allow` relaxes the policy to allow `https:` resources (CDNs, web fonts).
- This also protects editors and admins, who view mockups inside their authenticated session.

### 4.2 Bridge script

When serving a mockup the server inlines a small **bridge** script (built from `src/bridge`) at
the start of `<head>`. It runs inside the iframe and talks to the app only via `postMessage`
(the parent validates `event.source`, since the iframe origin is `null`).

The bridge is responsible for:

- **Inspect mode**: hover highlight like the Chrome element inspector (outline + tag label).
- **Hit testing**: on click, compute the element anchor (§4.4) and send it to the parent.
- **Pin markers**: render pins inside the document (in a closed shadow root) so they scroll with
  the content; report marker positions so the parent can place popovers.
- **Re-anchoring**: resolve stored anchors after load, resize, and DOM mutations.

The parent app owns all data and all comment UI. The mockup never sees the comment editor, so
mockup code cannot tamper with it.

### 4.3 Viewer identity

- On first visit to a share link the viewer is asked for a name (optional). Skipping assigns a
  generated name such as "Anonymous Fox".
- The browser stores a secret **viewer key** per mockup in `localStorage` and sends it in the
  `X-Loupe-Viewer` header; the server stores its hash. The key authorizes editing and deleting
  the viewer's own comments. Without a key, the threads can still be read.
- Each viewer gets a color from a fixed 12-color palette, assigned in order of arrival
  (`color_index = viewers on this mockup mod 12`). Editors use a distinct neutral style with an
  "Editor" badge.
- Identity is self-declared and unverified; this is documented in the UI.

### 4.4 Pin anchors

```jsonc
{
  "selector": "main > section:nth-of-type(2) > button.cta", // stable CSS path
  "offset": { "x": 0.42, "y": 0.18 },  // position inside the element's box, 0..1
  "text": "Get started",                // trimmed text snippet, for re-matching
  "point": { "x": 812, "y": 1430 },     // document coordinates, fallback
  "viewport": { "width": 1440, "height": 900 }
}
```

Selector strategy: unique `id` → `data-*` test/automation attributes → shortest unique
`tag:nth-of-type` path. Resolution order: selector (verified against `text` when present) →
text match → `point`. Pins that cannot be resolved are listed as **orphaned** in the side panel.

## 5. Viewer experience

- **Floating toolbar** (draggable): Pin · General comment · Show/hide pins · save status ·
  "Finish review" · shortcuts help.
- **Header**: mockup name, viewport switcher, presence avatars and the side-panel toggle.
- **Side panel**: the threads, filtered by Open / Mine / Resolved / All, with orphaned pins
  marked. Editors can open it filtered to one viewer (`?viewer=<id>`).
- **Pin flow**: press Pin (or `P`) → inspect mode → click an element → pin appears with a
  floating popover next to it → write → `Enter` / Send. `Esc` cancels; an empty pin is discarded.
- **General comment** (`C`): a popover attached to the toolbar.
- **Threads**: clicking a pin opens its thread: replies, edit/delete own comments, status.
- **Viewport switcher**: desktop / tablet / mobile widths (iframe width). Each pin records the
  viewport it was created at; switching shows a hint when it differs.
- **Finish review**: verdict (Approved / Changes requested) + optional summary. Adding comments
  after submitting moves the review back to `in_progress` until submitted again.
- **Moderation**: only editors resolve and reopen threads; authors edit their own comments;
  authors and editors delete them. Read-only mockups accept changes from editors only.
- **Shortcuts**: `P` pin, `C` comment, `H` hide pins, `Esc` cancel, `?` help.

### 5.1 Saving

Comments are discrete actions, so there is no keystroke autosave. Every action (create, reply,
edit, delete, resolve) is sent immediately with optimistic UI and a small status indicator:
"Saving…" → "Saved ✓", or "Offline — retrying" with automatic retry. Clients generate thread and
comment ids, so a retried request is answered with what it already created. Unsent replies and
general comments are kept in `localStorage` per thread and restored on reload.

### 5.2 Real time

One **Server-Sent Events** channel per mockup version broadcasts the full state of each changed
thread, deleted threads, review status and presence (who is connected, with name and color).
Loupe runs as a single process, so an in-memory pub/sub hub is sufficient. The client reads the
stream with `fetch`, so it can send the viewer key, reconnects with backoff, and refetches the
threads on every (re)connection instead of replaying missed events.

## 6. Editor experience

- **Workspace**: list of own projects (admins can switch to any user's workspace).
- **Project**: list of mockups with open/resolved counts and last activity.
- **Upload**: drag & drop an `.html` file. Checks: size limit (`LOUPE_MAX_UPLOAD_MB`, default
  20), valid UTF-8 HTML, and a warning listing external references when the file is not
  self-contained.
- **Share settings** per mockup: copy link, enable/disable, regenerate (old link stops working),
  optional expiry, read-only mode (comments visible, no new ones).
- **Reviews**: per mockup, a list grouped by viewer (color, name, thread counts open/resolved,
  verdict, last activity). Selecting a viewer opens the mockup filtered to their pins.
- **Moderation**: reply to any thread, resolve/reopen, delete any comment.

## 7. Configuration

All settings are environment variables prefixed with `LOUPE_`, validated at startup in
`src/server/config.ts`. The list of variables and their defaults is maintained in
[self-hosting.md](self-hosting.md#configuration).

## 8. Architecture

- **Runtime**: Node.js ≥ 24 (Docker image on the current LTS). Server TypeScript runs directly
  through Node's type stripping; no server build step.
- **Server**: Hono on `@hono/node-server`; Zod validation; Drizzle ORM on `node:sqlite`;
  migrations generated by drizzle-kit and applied at startup.
- **Web app**: Preact + `@preact/signals`, `preact-iso` router, Tailwind CSS 4, built by Vite and
  served as static files by the same Hono process.
- **Bridge**: a separate Vite IIFE build, inlined into served mockups.
- **Shared**: Zod schemas and types for the HTTP API and the bridge `postMessage` protocol live in
  `src/shared` and are imported by server, web app and bridge.
- **Deployment**: one container, one port, one volume (`/data`).

### 8.1 HTTP surface (sketch)

```
GET  /healthz

POST /api/auth/login | /api/auth/logout        GET /api/auth/me
GET  /api/auth/tokens/:token                    what a setup/invite/reset link is for
POST /api/auth/tokens/:token                    redeem it (create account or set password)
POST /api/admin/invites                         POST /api/admin/users/:id/reset-link
GET  /api/admin/users                           PATCH /api/admin/users/:id

GET|POST         /api/projects                  GET|PATCH|DELETE /api/projects/:id
GET|POST         /api/projects/:id/mockups      GET|PATCH|DELETE /api/mockups/:id
POST             /api/mockups/:id/share/regenerate
POST             /api/mockups/:id/versions      (v1.x)
GET              /api/mockups/:id/reviews

# Share-link scope (viewers and editors); viewer key in X-Loupe-Viewer header
GET  /api/s/:token                              mockup metadata + current version
POST /api/s/:token/viewers                      register viewer (name) → viewer key
GET  /api/s/:token/threads                      POST /api/s/:token/threads
POST /api/s/:token/threads/:id/comments         PATCH|DELETE /api/s/:token/comments/:id
PATCH /api/s/:token/threads/:id                 resolve/reopen (editor only)
PUT  /api/s/:token/review                       submit verdict
GET  /api/s/:token/events                       SSE

GET  /s/:token/content                          sandboxed mockup document (bridge inlined)
```

## 9. Roadmap

**MVP**: everything in §§1–8.

**v1.x**
- Mockup versions: upload v2, carry unresolved pins over by re-anchoring, list orphans.
- Export a review to Markdown / CSV (for GitLab/Jira issues).
- Webhooks (Slack, Teams, Mattermost) on review submitted.
- SMTP delivery of invite and reset links.

**Later**
- OIDC single sign-on.
- Admin backup download of `/data` and an activity log.
- UI localization (English default, Italian).
