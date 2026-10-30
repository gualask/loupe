# Self-hosting

Loupe ships as a single Docker image. It needs one port and one volume; there is no external
database and no email server.

## Run

```sh
docker run -d --name loupe \
  -p 3000:3000 \
  -v loupe-data:/data \
  -e LOUPE_PUBLIC_URL=https://loupe.example.com \
  gualask/loupe:latest
```

Or with Docker Compose:

```yaml
services:
  loupe:
    image: gualask/loupe:latest
    ports:
      - "3000:3000"
    volumes:
      - loupe-data:/data
    environment:
      LOUPE_PUBLIC_URL: https://loupe.example.com
    restart: unless-stopped

volumes:
  loupe-data:
```

The same image is published to Docker Hub (`gualask/loupe`) and to GitHub Container Registry
(`ghcr.io/gualask/loupe`). `latest` follows the newest stable release; pin a version such as
`gualask/loupe:0.1` to choose when to upgrade.

Always set `LOUPE_PUBLIC_URL` to the address people use to reach Loupe: setup, invite, reset and
share links are built from it, and without it they point to `localhost`.

## First run

On first start, while no account exists, Loupe prints a one-time setup link in its logs:

```sh
docker logs loupe
```

Open the link to create the first admin. From there, admins invite editors and other admins by
sending them invite links, and generate password-reset links when needed.

If the only admin loses their password, print a reset link from the container:

```sh
docker exec loupe loupe reset-link <username>
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `LOUPE_PORT` | `3000` | HTTP port |
| `LOUPE_DATA_DIR` | `/data` | SQLite database and uploaded mockups |
| `LOUPE_PUBLIC_URL` | `http://localhost:<port>` | Public base URL, used to build links and the only site allowed to frame mockups. With `https`, the session cookie is `Secure` and bound to the host |
| `LOUPE_MAX_UPLOAD_MB` | `20` | Maximum mockup size |
| `LOUPE_MOCKUP_EXTERNAL` | `block` | `allow` lets mockups load files and data from `https:` sites (CDNs, web fonts, APIs) and embed their pages |
| `LOUPE_MOCKUP_FORMS` | `block` | `allow` lets mockups handle form submissions in their own script |
| `LOUPE_MOCKUP_EVAL` | `block` | `allow` lets mockups run code built at run time (`eval`, `new Function`, WebAssembly) |
| `LOUPE_MOCKUP_MODALS` | `block` | `allow` lets mockups open browser dialogs (`alert`, `confirm`, `prompt`, `print`) |
| `LOUPE_MOCKUP_DOWNLOADS` | `block` | `allow` lets mockups download files |
| `LOUPE_MOCKUP_CLIPBOARD` | `block` | `allow` lets mockups copy to the clipboard |
| `LOUPE_SESSION_TTL_DAYS` | `30` | Days without use after which an editor or admin is signed out; sessions end 90 days after sign-in regardless |

## Mockup permissions

Uploaded mockups run in a sandbox that keeps them away from Loupe, its data and its sessions,
whatever their code does. By default they may also do nothing beyond running their own scripts:
anything more is a `LOUPE_MOCKUP_*` setting, so you allow only what your mockups need. When a
mockup uses something blocked, the review space says so, and shows editors the setting that
allows it. No setting lets a mockup reach Loupe itself; what they open up affects the people
who view mockups:

| Setting | What mockups can then do to viewers |
|---|---|
| `LOUPE_MOCKUP_EXTERNAL` | Other sites see the address and browser of everyone who opens the mockup, and when (for Google Fonts in the EU, a data transfer your privacy notice must cover). What viewers type into the mockup can be sent elsewhere. Files can change after the upload, so a version no longer guarantees what viewers see. |
| `LOUPE_MOCKUP_FORMS` | Nothing beyond running the mockup's own handlers: submissions still go nowhere. |
| `LOUPE_MOCKUP_EVAL` | No new reach, since mockups already run their scripts; it does expose the browser's WebAssembly compiler, and with `LOUPE_MOCKUP_EXTERNAL` makes mining in viewers' browsers efficient. |
| `LOUPE_MOCKUP_MODALS` | Show native dialogs headed by your Loupe address, such as a `prompt()` asking for a password, which viewers may take for Loupe; or open one dialog after another. |
| `LOUPE_MOCKUP_DOWNLOADS` | Save files to viewers' computers from your Loupe address. Reported malware harms the reputation of that address in browsers. |
| `LOUPE_MOCKUP_CLIPBOARD` | Put other text in the clipboard than what viewers meant to copy, e.g. a different command. |

Some things never work inside the sandbox: storage that survives a reload (what a mockup stores
lasts until it reloads), IndexedDB, saving to local files, reading the clipboard, camera,
microphone, location, notifications and service workers. Links to other sites, `mailto:` and
`tel:` open from a notice above the mockup instead of inside it.

## Reverse proxy

Put Loupe behind your usual HTTPS reverse proxy and set `LOUPE_PUBLIC_URL` to the public address.
Loupe compresses and sets cache headers itself, so the proxy needs no configuration for either.
Loupe does not send `Strict-Transport-Security`, since only the proxy knows that it serves https:
add it there, so browsers never reach Loupe over plain http. With nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    add_header Strict-Transport-Security "max-age=31536000" always;
}
```

Live updates use a Server-Sent Events stream (`/api/s/<token>/events`), which must reach the
browser unbuffered. Loupe marks it with `X-Accel-Buffering: no`, which nginx honors, and Caddy
and Traefik pass event streams through as they come. With another proxy or a CDN that buffers
responses, turn buffering off for that path. The stream sends a heartbeat every 25 seconds, so
idle timeouts of 30 seconds or more keep it open.

## Backup

All data lives in the `/data` volume. Stop the container before copying it, so the SQLite
database is consistent:

```sh
docker stop loupe
docker run --rm -v loupe-data:/data -v "$PWD":/backup alpine tar czf /backup/loupe-data.tgz -C /data .
docker start loupe
```

## Data and privacy

Loupe keeps everything in the `/data` volume and sends nothing to other services. If you publish
it, this is what your privacy notice needs to cover.

- **Accounts** (admins and editors): username, display name, a password hash, role, and when the
  account was created or disabled. Sessions keep only a hash of the session id, with when they
  were created, last used and expire.
- **Viewers** (people with a share link): per mockup, the name they chose or a generated one, a
  color, when they joined and a hash of their viewer key; then their pins, comments and edits,
  with their times. Opening a link is not recorded: editors see when a viewer last commented,
  never when they only looked.
- **Presence**: who has the review space open is kept in memory only and shown to the others on
  the same link while they are there.
- **In the viewer's browser**: `localStorage` holds the viewer key of each mockup, the chosen name
  and comments not sent yet.
- **Not stored**: IP addresses, user agents and request logs. The server logs only its start, the
  setup link and errors.
- **Retention**: viewer data lasts as long as its mockup; deleting a mockup or project deletes its
  viewers and threads. Used and expired account links and expired sessions are deleted
  automatically.
- **External resources**: with `LOUPE_MOCKUP_EXTERNAL=allow`, mockups may load files and data
  from other servers (CDNs, web fonts, APIs), which then see the address of whoever opens the
  mockup.
