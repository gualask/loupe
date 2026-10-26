# Loupe — Product & Technical Specification

Loupe is a self-hosted tool for reviewing HTML mockups. An editor uploads a self-contained HTML
file, shares a link, and viewers leave pinned comments on precise elements of the page. Everyone
with the link sees the same shared space in real time.

Status: pre-release. This document describes the MVP and the planned roadmap.

## 1. Roles

| Role | Account | Capabilities |
|---|---|---|
| **Admin** | yes | Everything an editor can do, on every workspace. Invites editors and admins, generates password-reset links, disables accounts. |
| **Editor** | yes | Owns a workspace: creates projects, uploads mockups and their new versions, manages share links, reads and resolves reviews. Is responsible for the content of the mockups they upload. |
| **Viewer** | no | Anonymous. Reaches a mockup through its share link, places pins, writes comments, submits a review, may choose a display name. |

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
- **Mockup**: a reviewable design with a share link. Holds one or more versions, numbered 1, 2,
  3…; the link always shows the latest, called the current version.
- **MockupVersion**: an uploaded HTML file (stored on disk, addressed by SHA-256). Threads and
  reviews belong to a version, so a new version starts without them; earlier versions keep theirs.
- **Viewer**: an anonymous participant of a single mockup, with display name and color. A viewer
  belongs to the mockup, not to a version, so they keep their identity across versions.
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
| `account_tokens` | `id`, `token_hash`, `kind` (`setup`/`invite`/`reset`), `role` (invite), `user_id` (reset), `created_at`, `expires_at` |
| `projects` | `id`, `owner_id`, `name`, `description`, `created_at` |
| `mockups` | `id`, `project_id`, `name`, `share_token`, `share_enabled`, `share_expires_at`, `read_only`, `current_version_id`, `created_by`, `created_at` |
| `mockup_versions` | `id`, `mockup_id`, `number`, `sha256`, `size_bytes`, `original_filename`, `external_refs` (JSON), `pin_count`, `uploaded_by`, `created_at` |
| `viewers` | `id`, `mockup_id`, `key_hash`, `display_name`, `color_index`, `created_at`, `last_seen_at` |
| `reviews` | `id`, `version_id`, `viewer_id`, `status` (`in_progress`/`submitted`), `verdict` (`approved`/`changes_requested`), `summary`, `submitted_at` |
| `threads` | `id`, `version_id`, `kind` (`pin`/`general`), `number` (pins only), `anchor` (JSON, pins only), `status`, `resolved_by`, `resolved_at`, `author_viewer_id` \| `author_user_id`, `created_at` |
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
- **Passwords**: Argon2id from `node:crypto`, with OWASP's minimum parameters (19 MiB, 2
  passes, 1 lane), stored as a standard PHC string that carries its parameters, so they can be
  raised later without breaking existing hashes. Minimum 10 characters.
- **Sessions**: opaque id in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` when
  `LOUPE_PUBLIC_URL` is https), stored hashed in SQLite. A session ends after 30 days without
  use (`LOUPE_SESSION_TTL_DAYS`), and in any case 90 days after sign-in, so a stolen cookie
  cannot be kept alive by using it. The expiry is extended only when it moves by more than an
  hour, so requests rarely write to the database.
  Signing in, or redeeming an account link, ends the browser's previous session; the account
  link page warns when someone is already signed in. When a session ends (expiry, logout in
  another tab, reset, disabled account), open pages return to the login page.
- **CSRF**: Hono `csrf()` middleware (Origin check) on all state-changing routes.
- **Brute force**: in-memory limit of 10 failed logins per username per 15 minutes. Account
  links carry 256-bit secrets and need no limit. The limit is per username, not per address:
  behind a reverse proxy every client shares one address. As a consequence, anyone can lock a
  known username out of signing in for 15 minutes; existing sessions keep working.
- **Request size**: API bodies are limited to 64 KB (`413 payload_too_large`); mockup uploads
  have their own limit.
- **Clean-up**: an account link is deleted when used; expired sessions and links are deleted at
  startup and then once a day.
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
  This enforces "self-contained": the mockup loads nothing from the network and cannot send
  requests.
- `LOUPE_MOCKUP_EXTERNAL=allow` relaxes the policy to allow `https:` resources (CDNs, web fonts).
- This also protects editors and admins, who view mockups inside their authenticated session.
- **Trust model**: the sandbox protects the app, its data and its sessions from mockup code. It
  does not protect viewers from deceptive content: a mockup can still draw anything, such as a
  fake form, and navigate its own frame elsewhere, which no browser policy can block. Mockups
  are therefore trusted to their editors, who are invited accounts responsible for what they
  upload (§1).
- Every other response carries an app policy: only the app's own scripts and files load, and
  no other site can frame the app (`frame-ancestors 'none'`, against clickjacking). All
  responses carry `X-Content-Type-Options: nosniff`.
- The document is sent with `Cache-Control: private, no-cache` and an `ETag` made of the file's
  SHA-256 and the bridge's hash: browsers revalidate on every load and get `304` when their copy
  is current. Access is checked first, so a disabled or expired link stops serving it.

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

- Opening a share link asks for nothing: anyone can read the mockup and its threads. The first
  change (pin, comment, reply, review) registers the viewer under a generated name such as
  "Anonymous Fox", or under the name they chose on an earlier mockup.
- Viewers change their name from the header at any time; the new name shows on all their threads
  and comments. The chosen name is remembered by the browser (`localStorage`) and used when they
  join other mockups. Names need not be unique.
- After a viewer joins under a generated name, a hint next to their name invites them, once per
  browser, to add their own; closing it or choosing a name stops it for good.
- The browser stores a secret **viewer key** per mockup in `localStorage` and sends it in the
  `X-Loupe-Viewer` header; the server stores its hash. The key authorizes editing and deleting
  the viewer's own comments. Without a key, the threads can still be read.
- Each viewer gets a color from a fixed 12-color palette, assigned in order of arrival
  (`color_index = viewers on this mockup mod 12`). Editors use a distinct neutral style with an
  "Editor" badge.
- Identity is self-declared and unverified; this is documented in the UI.
- **Abuse limits** (in memory): at most 60 new viewers per mockup per 10 minutes, and 30 changes
  (threads, comments, edits, deletions, reviews, renames) per viewer per minute. Editors are not limited.
  Exceeding a limit answers `429 too_many_requests`.

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
text match → selector match whose text changed (a copy edit should not detach the pin) →
`point`. Pins that fall back to `point` are listed as **orphaned** in the side panel.

Pins are numbered 1, 2, 3… per version in order of creation. A number is never reused: the
version counts every pin placed (`pin_count`), so deleting pin 2 leaves pin 3 as it was and the
next pin is 4. Until the server confirms a new pin, the client shows it with the next number.

## 5. Viewer experience

- **Floating toolbar** (draggable): Pin · General comment · Show/hide pins · save status ·
  "Finish review" · shortcuts help.
- **Header**: mockup name, viewport switcher, the viewer's own name (to change it, §4.3),
  presence avatars and the side-panel toggle. Editors also get a link back to the mockup page.
- **Side panel**: the threads, filtered by Open / Mine / Resolved / All, with orphaned pins
  marked. Editors can open it filtered to one viewer (`?viewer=<id>`).
- **Narrow screens** (below 768 px, e.g. phones): the side panel covers the mockup instead of
  sitting beside it, starts closed and closes when a thread opens or a pin or comment starts;
  the toolbar shows icons only; comment actions are always visible on touch screens.
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
"Saving…" → "Saved ✓", or "Offline — retrying" with automatic retry. Actions are sent one at a
time, in order, so a reply never reaches the server before its thread. Clients generate thread
and comment ids, so a retried request is answered with what it already created. When the server
rejects an action, the error is shown, its text goes back into its box, and the threads are
reloaded once no other action is pending. Unsent replies and general comments are kept in
`localStorage` per thread until the server has saved them, and restored on reload.

### 5.2 Real time

One **Server-Sent Events** channel per mockup version broadcasts the full state of each changed
thread, deleted threads and presence (who is connected, with name and color). A viewer's review
status is sent only to that viewer's own connections, e.g. other tabs.
Loupe runs as a single process, so an in-memory pub/sub hub is sufficient. The client reads the
stream with `fetch`, so it can send the viewer key, reconnects with backoff, and refetches the
threads on every (re)connection instead of replaying missed events. The stream sends a heartbeat every 25 seconds
and `X-Accel-Buffering: no`, so proxies neither drop it as idle nor hold events back.
At every heartbeat the server checks the link again: once it is disabled, regenerated or
expired, open streams end, so a revoked link stops receiving events within 25 seconds. A 4xx
answer on reconnection is final: the client stops retrying and loads the link again, which then
shows it as unavailable (or offers to retry if the server cannot be reached).

### 5.3 New versions

The review space sends the number of the version it shows in the `X-Loupe-Version` header.
Changes and the event stream are accepted only for the current version; for an older one the
server answers `409 version_changed`. Reading the threads of the version shown still works, so
the client can reload them after a rejected change. Open streams of an older version end at the
next heartbeat, and the reconnection is refused the same way.

On `version_changed` the review space stops accepting changes and shows "A new version of this
mockup is available · Reload" instead of an error; a rejected comment goes back into its box, so
its text is not lost. Reloading the page shows the current version, with the same viewer.

## 6. Editor experience

- **Workspace**: list of own projects (admins can switch to any user's workspace).
- **Project**: list of mockups with open/resolved counts and last activity; each row renames
  (inline) or deletes its mockup.
- **Upload**: drag & drop an `.html` file. Checks: size limit (`LOUPE_MAX_UPLOAD_MB`, default
  20), valid UTF-8 HTML, and a warning listing external references when the file is not
  self-contained.
- **New version**: from the mockup page, upload the next file with the same checks. It becomes
  the current version on the same share link; viewers keep their identity, and threads, reviews
  and activity counts start again from zero. Threads of earlier versions stay stored but are not
  shown in the MVP.
- **Share settings** per mockup: copy link, enable/disable, regenerate (old link stops working),
  optional expiry, read-only mode (comments visible, no new ones).
- **Reviews**: per mockup and for the current version, a list grouped by viewer (color, name, thread counts open/resolved,
  verdict, last activity). Selecting a viewer opens the mockup filtered to their pins.
- **Moderation**: reply to any thread, resolve/reopen, delete any comment.

Pages, share links and account links tell an item that does not exist (404) from one that could
not be loaded, e.g. offline or a server error, which offers to retry. Buttons that send a request
are disabled until it completes, so a double click does not send it twice.

## 7. Configuration

All settings are environment variables prefixed with `LOUPE_`, validated at startup in
`src/server/config.ts`. The list of variables and their defaults is maintained in
[self-hosting.md](self-hosting.md#configuration).

## 8. Architecture

- **Runtime**: Node.js ≥ 24.7, for native Argon2id (Docker image on the current LTS). Server TypeScript runs directly
  through Node's type stripping; no server build step.
- **Server**: Hono on `@hono/node-server`; Zod validation; Drizzle ORM on `node:sqlite`;
  migrations generated by drizzle-kit and applied at startup.
- **Web app**: Preact + `@preact/signals`, `preact-iso` router, Tailwind CSS 4, built by Vite and
  served as static files by the same Hono process.
- **Bridge**: a separate Vite IIFE build, inlined into served mockups.
- **Shared**: Zod schemas and types for the HTTP API and the bridge `postMessage` protocol live in
  `src/shared` and are imported by server, web app and bridge.
- **HTTP caching**: built assets (hashed names) are `immutable` for a year; `index.html` is
  `no-cache`, so an update takes effect at the next load; API responses are not cached.
- **Compression**: gzip for the web app and mockup documents. Not for API responses, which
  carry secrets next to user input (BREACH), nor for the event stream.
- **Deployment**: one container, one port, one volume (`/data`).

### 8.1 HTTP surface (sketch)

```
GET  /healthz

POST /api/auth/login | /api/auth/logout        GET /api/auth/me
GET  /api/auth/tokens/:token                    what a setup/invite/reset link is for
POST /api/auth/tokens/:token                    redeem it (create account or set password)
POST /api/admin/invites                         POST /api/admin/users/:id/reset-link
GET  /api/admin/users                           PATCH /api/admin/users/:id

GET|POST         /api/projects                  GET|PATCH|DELETE /api/projects/:id (with mockups)
POST             /api/projects/:id/mockups      GET|PATCH|DELETE /api/mockups/:id
POST             /api/mockups/:id/share/regenerate
POST             /api/mockups/:id/versions      upload the next version
GET              /api/mockups/:id/reviews

# Share-link scope (viewers and editors); viewer key in X-Loupe-Viewer header, version shown
# in X-Loupe-Version (§5.3)
GET  /api/s/:token                              mockup metadata + current version
POST /api/s/:token/viewers                      register viewer (name) → viewer key
PATCH /api/s/:token/viewers/me                  change the viewer's name
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
- Earlier versions: browse them with their threads, and see in a new version which comments
  of the previous one were resolved or are still open.
- Export a review to Markdown / CSV (for GitLab/Jira issues).
- Webhooks (Slack, Teams, Mattermost) on review submitted.
- SMTP delivery of invite and reset links.

**Later**
- OIDC single sign-on.
- Admin backup download of `/data` and an activity log.
- UI localization (English default, Italian).
