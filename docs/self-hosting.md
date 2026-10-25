# Self-hosting

Loupe ships as a single Docker image. It needs one port and one volume; there is no external
database and no email server.

## Run

```sh
docker run -d --name loupe \
  -p 3000:3000 \
  -v loupe-data:/data \
  -e LOUPE_PUBLIC_URL=https://loupe.example.com \
  ghcr.io/gualask/loupe:latest
```

Or with Docker Compose:

```yaml
services:
  loupe:
    image: ghcr.io/gualask/loupe:latest
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
| `LOUPE_PUBLIC_URL` | `http://localhost:<port>` | Public base URL, used to build links. With `https`, cookies are marked `Secure` |
| `LOUPE_MAX_UPLOAD_MB` | `20` | Maximum mockup size |
| `LOUPE_MOCKUP_EXTERNAL` | `block` | `allow` lets mockups load external `https:` resources (CDNs, web fonts) |
| `LOUPE_SESSION_TTL_DAYS` | `30` | Days without use after which an editor or admin is signed out; sessions end 90 days after sign-in regardless |

## Reverse proxy

Put Loupe behind your usual HTTPS reverse proxy and set `LOUPE_PUBLIC_URL` to the public address.
Loupe compresses and sets cache headers itself, so the proxy needs no configuration for either.
With nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
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
