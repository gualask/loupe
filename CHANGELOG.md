# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-30

### Added

- `LOUPE_MOCKUP_FORMS`, `LOUPE_MOCKUP_EVAL`, `LOUPE_MOCKUP_MODALS`, `LOUPE_MOCKUP_DOWNLOADS` and `LOUPE_MOCKUP_CLIPBOARD` let mockups handle forms, run code built at run time, open dialogs, download files and copy to the clipboard; each is blocked by default
- Notices in the review space and the editor's preview when a mockup uses something the server blocks, naming for editors the setting that allows it
- Links in mockups to other sites, `mailto:` and `tel:` show their address with an Open in new tab button

### Changed

- `LOUPE_MOCKUP_EXTERNAL=allow` also lets mockups fetch data from `https:` sites and embed their pages
- The warning about files from other sites says whether the server blocks them or loads them

### Fixed

- Mockups using `localStorage`, `sessionStorage` or cookies no longer stop with an error; what they store lasts until they reload
- A mockup that leaves its page no longer leaves an error page in the preview: it can be reloaded in place
- Connection hints such as `<link rel="preconnect">` no longer count as files from other sites

## [0.1.0] - 2026-10-30

### Added

- Projects, listed by latest upload or comment with their open and resolved comments and those awaiting a reply, and HTML mockup upload with size, encoding and self-containment checks
- New versions of a mockup on the same link: reviewers keep their name, and each version starts without comments
- Mockups served in a sandbox, so uploaded code cannot reach the app, its data or sessions
- Share links with copy and regeneration
- Archiving of finished mockups: their comments stay readable, nothing new is accepted
- Pins anchored to page elements, picked with an inspector-style selector, that follow layout changes
- General comments, threaded replies, editing, deletion, and resolve or reopen by editors, who see which threads await their reply
- Anonymous reviewers with generated names they can change, colors and live presence, with no account or sign-up prompt
- Reviewers listed to editors with their open and resolved comments and last activity
- Real-time updates, saving with automatic retry while offline, and unsent drafts kept on reload
- Viewport switcher, keyboard shortcuts and a review space usable on phones
- Comparison of the current version with an earlier one, side by side or one above the other, open to everyone on the link
- Deletion of earlier versions, with their comments, by editors
- Admin and editor accounts through single-use setup, invite and password-reset links
- Admin user management and workspace switching, and `loupe reset-link` for locked-out admins
- Rate limits on logins, new reviewers and reviewer changes, and a cap on password checks running at once
- Docker image on Docker Hub and GitHub Container Registry, with a health check, configured through `LOUPE_*` environment variables
- Loupe logo in the app, browser tab icon and home-screen icon
- Browser tabs named after the page shown

[Unreleased]: https://github.com/gualask/loupe/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/gualask/loupe/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/gualask/loupe/releases/tag/v0.1.0
