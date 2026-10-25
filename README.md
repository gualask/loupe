# Loupe

Drop an HTML mockup, share a link, collect pinned feedback.

Loupe is a small self-hosted app for design reviews. An editor uploads a self-contained HTML
mockup and shares its link; reviewers place pins on precise elements of the page and comment on
them, together and in real time. Reviewers need no account, and no email server is required.

> **Status:** early release (0.x): ready to try, expect rough edges until 1.0.

## Features

- Pins anchored to page elements, picked with an inspector-style element selector
- General comments, threads, resolve and reopen
- Anonymous reviewers with names, colors and live presence
- A review per reviewer, with a verdict: approved or changes requested
- Share links with expiry, revocation and read-only mode
- Mockups isolated in a sandbox, so uploaded code cannot reach the app
- Editor and admin accounts created through invite links
- One container, one port, one volume

## Quick start

```sh
docker run -d --name loupe -p 3000:3000 -v loupe-data:/data \
  -e LOUPE_PUBLIC_URL=http://loupe.example.com:3000 \
  ghcr.io/gualask/loupe:latest
```

Set `LOUPE_PUBLIC_URL` to the address people use to reach Loupe: setup, invite and share links
are built from it. Then follow the first-run steps in the [self-hosting guide](docs/self-hosting.md).

## Documentation

- [Self-hosting](docs/self-hosting.md): installation, first run, configuration, reverse proxy
- [Development](docs/development.md): local setup and project commands
- [Specification](docs/SPEC.md): product behavior and architecture
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE) © 2026 Andrea Gualandi (Gorgonauta)
