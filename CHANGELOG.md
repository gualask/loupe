# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Projects and HTML mockup upload, with size, encoding and self-containment checks
- New versions of a mockup on the same link: reviewers keep their name, and each version starts without comments
- Mockups served in a sandbox, so uploaded code cannot reach the app, its data or sessions
- Share links with copy, revocation, regeneration, expiry and read-only mode
- Pins anchored to page elements, picked with an inspector-style selector, that follow layout changes
- General comments, threaded replies, editing, deletion, and resolve or reopen by editors
- Anonymous reviewers with generated names they can change, colors and live presence, with no account or sign-up prompt
- Reviews per reviewer with a verdict, listed to editors with their open and resolved comments
- Real-time updates, saving with automatic retry while offline, and unsent drafts kept on reload
- Viewport switcher, keyboard shortcuts and a review space usable on phones
- Admin and editor accounts through single-use setup, invite and password-reset links
- Admin user management and workspace switching, and `loupe reset-link` for locked-out admins
- Rate limits on logins, new reviewers and reviewer changes
- Docker image with a health check, configured through `LOUPE_*` environment variables

[Unreleased]: https://github.com/gualask/loupe/commits/main
