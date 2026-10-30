# Loupe — Product & Technical Specification

Loupe is a self-hosted tool for reviewing HTML mockups. An editor uploads a self-contained HTML
file, shares a link, and viewers leave pinned comments on precise elements of the page. Everyone
with the link sees the same shared space in real time.

Status: pre-release. This document describes the MVP and the planned roadmap.

## 1. Roles

| Role | Account | Capabilities |
|---|---|---|
| **Admin** | yes | Everything an editor can do, on every workspace. Invites editors and admins, generates password-reset links, disables accounts. |
| **Editor** | yes | Owns a workspace: creates projects, uploads mockups and their new versions, manages share links, reads and resolves comments. Is responsible for the content of the mockups they upload. |
| **Viewer** | no | Anonymous. Reaches a mockup through its share link, places pins, writes comments, may choose a display name. |

Only admins and editors have accounts. Viewers are identified per browser (see §4.3).

## 2. Domain model

```
User ──owns──▶ Project ──contains──▶ Mockup ──has──▶ MockupVersion
                                       │
                                       ├──▶ Viewer (per-mockup anonymous identity)
                                       └──▶ Thread (pin | general) ──▶ Comment
```

- **Project**: a named container of mockups inside an editor's workspace.
- **Mockup**: a reviewable design with a share link. Holds one or more versions, numbered 1, 2,
  3…; the link always shows the latest, called the current version.
- **MockupVersion**: an uploaded HTML file (stored on disk, addressed by SHA-256). Threads
  belong to a version, so a new version starts without them; earlier versions keep theirs.
  Earlier versions stay viewable through the link for comparison until an editor deletes them
  (§6).
- **Viewer**: an anonymous participant of a single mockup, with display name and color. A viewer
  belongs to the mockup, not to a version, so they keep their identity across versions.
- **Thread**: either a **pin** (anchored to a DOM element) or a **general** comment. Has a status:
  `open` while something is left to do, `resolved` once an editor closed it. A version needs no
  more work when none of its threads is open. An open thread **awaits reply** while its latest
  visible comment is a viewer's: a new pin or comment, or an answer to an editor. Archived
  mockups have none, since they accept no replies.
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
| `mockups` | `id`, `project_id`, `name`, `share_token`, `archived_at`, `current_version_id`, `created_by`, `created_at` |
| `mockup_versions` | `id`, `mockup_id`, `number`, `sha256`, `size_bytes`, `original_filename`, `external_refs` (JSON), `pin_count`, `uploaded_by`, `created_at` |
| `viewers` | `id`, `mockup_id`, `key_hash`, `display_name`, `color_index`, `created_at` |
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
  Admins cannot change their own account, and a change that would leave no active admin, such
  as two admins disabling each other at the same moment, is refused (`409 last_admin`), so at
  least one admin always remains.
- **Locked-out admin**: `docker exec loupe loupe reset-link <username>` prints a reset link.
- **Passwords**: Argon2id from `node:crypto`, with OWASP's minimum parameters (19 MiB, 2
  passes, 1 lane), stored as a standard PHC string that carries its parameters, so they can be
  raised later without breaking existing hashes. Minimum 10 characters.
- **Sessions**: opaque id in an `HttpOnly`, `SameSite=Lax` cookie, stored hashed in SQLite. When
  `LOUPE_PUBLIC_URL` is https the cookie is `Secure` and named `__Host-loupe_session`, so
  browsers take it only from Loupe's own host and a sibling subdomain cannot plant one. A
  session ends after 30 days without use (`LOUPE_SESSION_TTL_DAYS`), and in any case 90 days
  after sign-in, so a stolen cookie cannot be kept alive by using it. The expiry is extended
  only when it moves by more than an hour, so requests rarely write to the database.
  Signing in, or redeeming an account link, ends the browser's previous session; the account
  link page warns when someone is already signed in. When a session ends (expiry, logout in
  another tab, reset, disabled account), open pages return to the login page at their next
  request or when their window regains focus, which checks the session again; a page whose
  browser has meanwhile signed in as someone else reloads as that user. A review space checks
  in the same way who it writes as, since a session started or ended in another tab changes it
  (§4.3), and reloads under the new identity. A session that cannot be checked, e.g. offline,
  offers to retry instead of signing out.
- **CSRF**: Hono `csrf()` middleware (Origin check) on all state-changing routes.
- **Brute force**: in-memory limit of 10 failed logins per username per 15 minutes. Account
  links carry 256-bit secrets and need no limit. The limit is per username, not per address:
  behind a reverse proxy every client shares one address. As a consequence, anyone can lock a
  known username out of signing in for 15 minutes; existing sessions keep working.
  Attempts with ever different usernames escape that limit, and every password check costs an
  Argon2id hash: at most 2 hashes run at once and 20 more wait, beyond which sign-ins and account
  links answer `503 server_busy`. Hashes share Node's thread pool with file reads, so a flood of
  sign-ins cannot stall the serving of mockups.
- **Request size**: API bodies are limited to 64 KB (`413 payload_too_large`); mockup uploads
  have their own limit.
- **Clean-up**: an account link is deleted when used; expired sessions and links are deleted at
  startup and then once a day.
- **Roadmap**: optional SMTP to email invite/reset links (v1.x); OIDC single sign-on (later).

## 4. Mockup viewing

### 4.1 Isolation

Uploaded HTML is untrusted. It is never served as a regular page of the app:

- It is served with a `Content-Security-Policy` whose `sandbox` directive lists `allow-scripts`
  and the flags of the permissions granted (below), plus a resource policy, and embedded in an
  `<iframe>` with the same sandbox flags: mockup payloads carry the server's `permissions`, from
  which the app builds the iframe. The document runs in an **opaque origin**: it cannot read app
  cookies, storage, or call the app API, even though everything is on one host. No setting ever
  adds `allow-same-origin`, `allow-top-navigation` or `allow-popups`.
- Default resource policy, with every permission blocked:
  `default-src 'none'; script-src 'unsafe-inline' data: blob:; style-src 'unsafe-inline' data:;
  img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none';
  form-action 'none'`, with `Permissions-Policy: clipboard-write=()`. The mockup loads nothing
  from the network, sends no requests and evaluates no strings as code.
- **Permissions**: each is blocked unless its variable is `allow`; the risks of each are listed
  in [self-hosting.md](self-hosting.md#mockup-permissions).

  | Permission | Variable | Effect |
  |---|---|---|
  | `external` | `LOUPE_MOCKUP_EXTERNAL` | `https:` scripts, styles, images, fonts and media; `connect-src https: wss:`; `frame-src https:` |
  | `forms` | `LOUPE_MOCKUP_FORMS` | `allow-forms`: submit events fire for the mockup's script; `form-action 'none'` still keeps submissions from leaving |
  | `eval` | `LOUPE_MOCKUP_EVAL` | `'unsafe-eval' 'wasm-unsafe-eval'`: `eval`, `new Function`, WebAssembly |
  | `modals` | `LOUPE_MOCKUP_MODALS` | `allow-modals`: `alert`, `confirm`, `prompt`, `print` |
  | `downloads` | `LOUPE_MOCKUP_DOWNLOADS` | `allow-downloads` |
  | `clipboard` | `LOUPE_MOCKUP_CLIPBOARD` | iframe `allow="clipboard-write"`, without the `Permissions-Policy` header |

- This also protects editors and admins, who view mockups inside their authenticated session.
- **Trust model**: the sandbox protects the app, its data and its sessions from mockup code. It
  does not protect viewers from deceptive content: a mockup can still draw anything, such as a
  fake form, or point to another site, which the app offers to open (§4.2). Mockups are
  therefore trusted to their editors, who are invited accounts responsible for what they upload
  (§1).
- The document may be framed only by the app (`frame-ancestors 'self'` plus the origin of
  `LOUPE_PUBLIC_URL`, since browsers have resolved `'self'` differently in sandboxed documents).
- Every other response carries an app policy: only the app's own scripts and files load, and
  no other site can frame the app (`frame-ancestors 'none'`, against clickjacking). All
  responses carry `X-Content-Type-Options: nosniff`.
- Earlier versions are served the same way, at `/s/<token>/versions/<number>/content`, with the
  same policies and the same access check; a number that is not a stored version of the mockup
  answers `404`.
- The document is sent with `Cache-Control: private, no-cache` and a weak `ETag` made of the
  file's SHA-256 and the bridge's hash: browsers revalidate on every load and get `304` when
  their copy is current. Access is checked first, so a regenerated link stops serving it.
- The server prepares each document once, bridge inlined and gzip-compressed, and keeps the most
  recently served ones in memory (64 MB in all), so repeated loads neither read the file again
  nor compress it.

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
- **Sandbox guards**, installed before any mockup code runs:
  - `localStorage`, `sessionStorage` and `document.cookie`, which an opaque origin denies, are
    replaced with storage in memory that lasts until the document reloads. IndexedDB stays
    unavailable.
  - Links that would leave the document (another page, another scheme, another target),
    `window.open()` and links clicked by script are stopped and reported (`loupe:link`), so the
    frame never turns into an error page. A link to another fragment or query of the document
    still works. Links the mockup's own handlers prevented, such as a router's, are left alone.
  - Submissions no script prevented are cancelled, and `form.submit()` does nothing: with
    `form-action 'none'` they would only end on an error page.
  - Each permission the mockup uses is reported once per document (`loupe:attempt`): forms
    (submit buttons, Enter in a field, `submit()`, `requestSubmit()`), dialogs, downloads,
    clipboard writes, and, from CSP violation reports, `eval` and external files. The app keeps
    those this server blocks (§5).
- **Liveness**: on every load of the frame the app sends `loupe:ping`; the bridge answers with
  `loupe:ready` and reports its permissions again. A frame silent for 2 seconds is lost, e.g.
  after a script took it to another site, which the app's policy refuses to frame: the app
  covers it with a Reload button.

The parent app owns all data and all comment UI. The mockup never sees the comment editor, so
mockup code cannot tamper with it.

### 4.3 Viewer identity

- Opening a share link asks for nothing: anyone can read the mockup and its threads. The first
  change (pin, comment, reply, review) registers the viewer under a generated name such as
  "Anonymous Fox", or under the name they chose on an earlier mockup.
- Viewers change their name from the profile menu in the header while the mockup accepts comments; the new name shows
  on all their threads and comments. The chosen name is remembered by the browser (`localStorage`) and used when they
  join other mockups. Names need not be unique.
- After a viewer joins under a generated name, a hint below their avatar invites them, once per
  browser, to add their own; closing it or choosing a name stops it for good.
- The browser stores a secret **viewer key** per mockup in `localStorage` and sends it in the
  `X-Loupe-Viewer` header; the server stores its hash. The key authorizes editing and deleting
  the viewer's own comments. Without a key, the threads can still be read.
- Each viewer gets a color from a fixed 12-color palette, assigned in order of arrival
  (`color_index = viewers on this mockup mod 12`). Editors use a distinct neutral style with an
  "Editor" badge.
- Identity is self-declared and unverified; this is documented in the UI.
- **Abuse limits** (in memory): at most 60 new viewers per mockup per 10 minutes, and 30 changes
  (threads, comments, edits, deletions, renames) per viewer per minute. Editors are not limited.
  Exceeding a limit answers `429 too_many_requests`.

### 4.4 Pin anchors

```jsonc
{
  "selector": "main > section:nth-of-type(2) > button.cta", // stable CSS path
  "offset": { "x": 0.42, "y": 0.18 },  // position inside the element's box, 0..1
  "text": "Get started",                // trimmed text snippet, for re-matching
  "point": { "x": 812, "y": 1430 }      // document coordinates, fallback
}
```

Selector strategy: unique `id` → `data-*` test/automation attributes → shortest unique
`tag:nth-of-type` path. Resolution order: selector (verified against `text` when present) →
text match → selector match whose text changed (a copy edit should not detach the pin) →
`point`. Pins that fall back to `point` are listed as **orphaned** in the side panel, also
while pins are hidden.

Pins are numbered 1, 2, 3… per version in order of creation. A number is never reused: the
version counts every pin placed (`pin_count`), so deleting pin 2 leaves pin 3 as it was and the
next pin is 4. Until the server confirms a new pin, the client shows it with the next number.

## 5. Viewer experience

- **Header**: mockup name and save status; the review tools Pin and General comment; the avatars
  of the others present (up to 10 from 1280 px, 5 from 640 px, 3 below, then a count), what shows
  (viewport switcher, comparison, Show/hide pins, side-panel toggle) and, last as in the rest of
  the app, the profile menu. Editors also get a link back to the mockup page.
- **Profile menu**: the avatar of whoever is reviewing (a generic icon for a viewer who has not
  joined yet) opens who they are here, "Change your name" for viewers while the mockup accepts
  comments (§4.3), the shortcuts help, except on touch screens, and "Sign out" for editors, who
  then stay on the link as a guest, or as the viewer they were. With none of these, the avatar
  opens nothing.
- **Side panel**: the threads, filtered by Open / Mine / Resolved / All, with orphaned pins
  marked, and for editors the threads that await their reply (§2). Editors can open it
  filtered to one viewer (`?viewer=<id>`).
- **Narrower screens**: below 1024 px the review actions show icons only and the viewport switcher
  and the comparison button are hidden. Below 768 px (e.g. phones) the side panel covers the
  mockup instead of sitting beside it, starts closed and closes when a thread opens or a pin or
  comment starts, and the review actions move to a second header row. Comment actions are always
  visible on touch screens.
- **Pin flow**: press Pin (or `P`) → inspect mode → click an element → pin appears with a
  floating popover next to it → write → `Enter` / Send. `Esc` cancels; an empty pin is discarded.
- **General comment** (`C`): a popover below the Comment button of the header.
- **Threads**: clicking a pin opens its thread: replies, edit/delete own comments, status.
- **Viewport switcher**: desktop / tablet / mobile widths (iframe width). Pins follow their
  element at any width (§4.4). A width wider than the space keeps its size and scrolls sideways.
- **Comparison**: when the mockup has earlier versions, anyone on the link can show one beside
  the current version, the latest earlier one first, and pick another in its bar. The earlier
  version comes first: on the left, or above once switched to one above the other, which gives
  both the full width. Each pane names its version and takes the chosen preview width. The
  earlier version is read-only: no pins or comments, only the shortcuts work inside it. Opening
  or closing it does not reload the current version, and it closes at once if an editor deletes
  the version shown.
- **Moderation**: only editors resolve and reopen threads; authors edit their own comments;
  authors and editors delete them. Archived mockups accept no review changes from anyone (§6).
- **Shortcuts**: `P` pin, `C` comment, `H` hide pins (which also closes an open pin's thread),
  `Esc` cancel, `?` help.
- **Mockup notices**, below the header and dismissible: the address of the latest link that
  would have left the mockup, with Open in new tab (`noopener noreferrer`; http, https, mailto
  and tel only); and the permissions the mockup uses that this server blocks, with, for editors,
  the variables that allow them (§4.1). The editor's preview on the mockup page shows the same
  notices, starting with the files from other sites found at upload (§6), which take the place
  of the runtime notice about them. A new version starts its preview without notices.

### 5.1 Saving

Comments are discrete actions, so there is no keystroke autosave. Every action (create, reply,
edit, delete, resolve) is sent immediately with optimistic UI and a small status indicator:
"Saving…" → "Saved ✓", or "Offline — retrying" with automatic retry, also while the server
answers with a 5xx error (e.g. a proxy's 502 while Loupe restarts). Actions are sent one at a
time, in order, so a reply never reaches the server before its thread. Clients generate thread
and comment ids, including a thread's first comment, so a retried request is answered with what
it already created. When the server rejects an action (4xx), the error is shown, its text goes
back into its box, and the threads are reloaded once no other action is pending. Unsent replies
and general comments are kept in `localStorage` per thread until the server has saved them, and
restored on reload; a box reopened while its text is being sent starts empty.

### 5.2 Real time

One **Server-Sent Events** channel per mockup version broadcasts the full state of each changed
thread, deleted threads, presence (who is connected, with name and color; readers who have not
joined are not shown, and their arrival is told to nobody but themselves), viewers' new names,
which clients apply wherever the viewer appears, the mockup being archived or unarchived,
which closes or reopens open review spaces to changes at once, and the deletion of an earlier
version, which review spaces stop offering for comparison.
Loupe runs as a single process, so an in-memory pub/sub hub is sufficient. The client reads the
stream with `fetch`, so it can send the viewer key, reconnects with backoff, and refetches the
threads on every (re)connection instead of replaying missed events, once its pending actions
are saved so the refetch does not hide them. The stream sends a heartbeat every 25 seconds
and `X-Accel-Buffering: no`, so proxies neither drop it as idle nor hold events back.
Regenerating the link or deleting the mockup or its project ends its open streams at once. As
a safety net, each version also checks its link at every heartbeat, with one lookup for all its
streams, and ends those whose link no longer serves it. A 4xx answer on reconnection is final:
the client stops retrying and loads the link again, which then shows it as unavailable (or
offers to retry if the server cannot be reached).

### 5.3 New versions

The review space sends the number of the version it shows in the `X-Loupe-Version` header; a
value that is not a version number answers `400 invalid_request`. Changes and the event stream
are accepted only for the current version; for an older one the server answers
`409 version_changed`. Reading the threads of the version shown still works, so the client can
reload them after a rejected change. Open streams of the previous version end as soon as the
new one is uploaded, and the reconnection is refused the same way.

On `version_changed` the review space stops accepting changes and shows "A new version of this
mockup is available · Reload" instead of an error, also where replies are written.
Reloading the page shows the current version, with the same viewer. Unsent text is not lost: the
text of a rejected pin is set aside in the general comment draft, a rejected general comment
stays in it, and after the reload the reply drafts of threads no longer listed join it too. The
general comment box then opens with that text and a note asking to send, edit or discard it.

## 6. Editor experience

- **Workspace**: list of own projects, most recently updated first: each row shows the name,
  description, open/resolved counts summed over the current versions of its mockups, a badge
  with the threads among them that await reply (§2), when there are any, mockup count and when
  it was last updated (latest of its creation, a version upload or a comment in any of its
  mockups); its actions menu edits (in a dialog) or deletes the project. Projects and mockups are
  listed with the same table. The path in the top bar starts from the logo, which leads to one's
  own workspace; for admins it continues with the workspace of the page shown (not linked on the
  workspace page itself), from where they switch to any user's workspace or to all of them
  (`?owner=<user id>|all`). Editors, with a single workspace, get no such step; another user's
  workspace offers no New project, since new projects belong to whoever creates them. Mockups
  carry their project's owner, so a mockup page links back to the right workspace.
- **Project**: list of mockups with version, file name and size, open/resolved counts, a badge
  with the threads that await reply, and last activity; each row's actions menu renames (in a
  dialog), archives, unarchives or deletes its mockup. Every mockup the API returns carries this
  activity of its current version.
- **Upload**: from the project page, pick an `.html` file. Checks: size limit (`LOUPE_MAX_UPLOAD_MB`, default
  20), valid UTF-8 HTML, and a warning listing external references when the file is not
  self-contained, which says whether this server blocks those files or loads them. Connection
  hints (`<link rel="preconnect">`, `dns-prefetch`) load nothing and are not listed. File names
  are kept up to 255 characters.
- **New version**: from the mockup page, upload the next file with the same checks. It becomes the
  current version on the same share link; viewers keep their identity, and threads and activity
  counts start again from zero. Threads of earlier versions stay stored but are not shown in the
  MVP (the versions themselves can be compared, §5), so the upload first reloads the activity of
  the current version and asks for confirmation when it has threads (from viewers or editors). A
  file identical to the current version is refused (`409 same_file`).
- **Earlier versions**: the actions menu of a mockup, on its page or its row, lists them, latest
  first, with their upload time and file name, from version 2 on. Editors delete one that should
  no longer be seen (e.g. it showed wrong data), with its threads, after a confirmation; its file
  goes once no version uses it. The current version cannot be deleted (`409 current_version`);
  archived mockups allow it too, since it is not a review change. Numbers are never reused: the
  next upload follows the latest number.
- **Share link** per mockup: anyone with it can open the mockup and comment. It can be copied
  and regenerated, which stops the old link for good (e.g. when it reached the wrong people).
- **Archive**: marks the work on a mockup as concluded, without losing anything. Its link keeps
  showing the mockup and its comments, but nobody, editors included, can change the review: pin,
  comment, reply, edit, delete, resolve, join or rename (`403 archived`). No new version
  can be uploaded either (`409 archived`, checked again once the file is received). Its editors
  can still rename it, regenerate its link or delete it.
  The project lists archived mockups in a separate section, closed by default, where each can be
  unarchived; the mockup page shows the archiving date with an Unarchive button, so a mistaken
  click is undone in place. The date of the first archiving is kept until then.
- **Mockup page**: the name with the number of the current version, whose upload time and file
  name show on hover, and a preview of the current version under its notices (§5).
- **Actions**: the mockup page shows its frequent actions (upload a new version, open the review
  space); renaming, archiving, earlier versions and deleting sit in an actions menu. A project
  page and a mockup page offer the same menu as their card or row in the list. Delete comes last,
  in red and set apart, and asks for confirmation since it cannot be undone.
- **Dialogs**: creating or editing a project, renaming a mockup and every confirmation open a
  modal dialog over the page, which stays inert behind it until the dialog is closed; Escape
  and Cancel close it without changes, except while its request is running.
- **Reviewers**: per mockup and for the current version, a list of viewers (color, name, thread
  counts open/resolved, last activity), the most recently active first, under the open and resolved
  threads of the version.
  Last activity is the latest comment or edit on the current version: opening
  the link is not recorded, so editors never learn when a viewer only looked.
  The list scrolls on its own beside the share link, which stays in reach; on narrow screens it
  shows the first rows and the rest on request. Viewers of earlier versions stay listed,
  without feedback until they comment on the current one. Selecting a viewer opens the mockup
  filtered to their pins.
- **Moderation**: reply to any thread, resolve/reopen, delete any comment.

Every page, the review space included, names the browser tab after what it shows (e.g.
"landing — Loupe", "Review of landing — Loupe"), so tabs and history entries can be told apart.

Pages, share links and account links tell an item that does not exist (404) from one that could
not be loaded, e.g. offline or a server error, which offers to retry. Buttons that send a request
are disabled until it completes, so a double click does not send it twice.

## 7. Configuration

All settings are environment variables prefixed with `LOUPE_`, validated at startup in
`src/server/config.ts`. The list of variables and their defaults is maintained in
[self-hosting.md](self-hosting.md#configuration).

## 8. Architecture

- **Runtime**: Node.js ≥ 26.13, an LTS release with native Argon2id; the Docker image, CI and
  `.nvmrc` use the exact release. Server TypeScript runs directly through Node's type
  stripping; no server build step.
- **Server**: Hono on `@hono/node-server`; Zod validation; Drizzle ORM on `node:sqlite`;
  migrations generated by drizzle-kit and applied at startup.
- **Web app**: Preact + `@preact/signals`, `preact-iso` router, Tailwind CSS 4, built by Vite and
  served as static files by the same Hono process.
- **Bridge**: a separate Vite IIFE build, inlined into served mockups.
- **Shared**: Zod schemas and types for the HTTP API and the bridge `postMessage` protocol live in
  `src/shared` and are imported by server, web app and bridge.
- **HTTP caching**: built assets (hashed names) are `immutable` for a year; `index.html` is
  `no-cache`, so an update takes effect at the next load; API responses are not cached.
- **Compression**: gzip for the web app and mockup documents, which are compressed once and
  cached (§4.1). Not for API responses, which carry secrets next to user input (BREACH), nor
  for the event stream.
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
GET              /api/mockups/:id/versions      earlier versions, latest first
DELETE           /api/mockups/:id/versions/:n   delete an earlier version
GET              /api/mockups/:id/reviewers

# Share-link scope (viewers and editors); viewer key in X-Loupe-Viewer header, version shown
# in X-Loupe-Version (§5.3)
GET  /api/s/:token                              mockup metadata, current and earlier versions
POST /api/s/:token/viewers                      register viewer (name) → viewer key
PATCH /api/s/:token/viewers/me                  change the viewer's name
GET  /api/s/:token/threads                      POST /api/s/:token/threads
POST /api/s/:token/threads/:id/comments         PATCH|DELETE /api/s/:token/comments/:id
PATCH /api/s/:token/threads/:id                 resolve/reopen (editor only)
GET  /api/s/:token/events                       SSE

GET  /s/:token/content                          sandboxed mockup document (bridge inlined)
GET  /s/:token/versions/:n/content              the same, for any stored version
```

## 9. Roadmap

**MVP**: everything in §§1–8.

**v1.x**
- Earlier versions: show their threads beside them when comparing, and see in a new version which
  comments of the previous one were resolved or are still open.
- Export the comments of a version to Markdown / CSV (for GitLab/Jira issues).
- Webhooks (Slack, Teams, Mattermost) on new comments.
- SMTP delivery of invite and reset links.
- Pins being placed, seen live: while someone picks an element and writes, the others see a
  ghost pin in their color with "writing…", gone if they cancel. The text shows only once sent.

**Later**
- OIDC single sign-on.
- Admin backup download of `/data` and an activity log.
- UI localization (English default, Italian).
