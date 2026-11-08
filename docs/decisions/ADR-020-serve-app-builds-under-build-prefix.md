# ADR-020: Serve app builds under /_build/<buildId>/

## Status

Accepted

## Date

2026-11-08

## Context

An app site ([ADR-019](ADR-019-add-an-app-site-kind.md)) serves a prebuilt static build: an `index.html` plus JS, CSS and media in whatever folders the bundler chose, such as Vite's `assets/index-AbC12.js`. JS chunks import each other by relative URL, sometimes in cycles, and CSS refers to fonts and images the same way.

Page assets already have a contract: content-hashed names at `/assets/<hash>.<ext>`, stored at `sites/<siteId>/assets/<hash>.<ext>` (SPEC §5). Every reference to them is written by publish, which owns the page's HTML.

## Decision

Each build's files keep their own names and folders. They are stored at `sites/<siteId>/builds/<buildId>/<path>` and served at `/_build/<buildId>/<path>`.

- Only `index.html` is rewritten at deploy: each relative URL (`./assets/x.js`) becomes `/_build/<buildId>/assets/x.js`. Everything else resolves relative to its own URL, so a build made with a relative base (Vite `base: "./"`) works unchanged inside its folder.
- `buildId` is 16 hex characters derived from the build's contents, so a build's URLs never change and its files take the immutable asset headers.
- The route serves only `ASSET_CONTENT_TYPES` plus `json` (`BUILD_CONTENT_TYPES` in `@workspace/core`). HTML and SVG are refused because build files are served without the page security policy, and both could run script in the site's origin. A refused, malformed or missing file gets the site's 404 page.
- `parseBuildPath` and `buildKey` in `@workspace/core` are the one place the URL and key shapes live.

## Alternatives Considered

### Rename every file to `/assets/<hash>.<ext>`

- Pros: reuses the existing asset route and storage; files dedupe across builds by content
- Cons: every reference inside JS chunks and CSS would have to be rewritten, including chunk-to-chunk imports that can form cycles, so a file's hash would depend on files that depend on it
- Rejected: rewriting bundler output is fragile and breaks the bundler's own guarantees

### Serve the build at the site's root (`/assets/…` as the bundler emits it)

- Pros: no rewrite at all, even for absolute-base builds
- Cons: collides with the `/assets/` page-asset route and `/_api/`; old and new builds would share URLs, so files couldn't be cached as immutable
- Rejected: a per-build prefix keeps builds immutable and apart from platform routes

## Consequences

- Each deploy that changes any file stores a full copy of the build under a new `buildId`. Storage grows per deploy until pruning is decided (SPEC §11 open questions).
- Apps must build with a relative base, separate JS and CSS files, and no inline scripts or styles; the deploy checks enforce this (task `add-app-build-deploys`).
- `/_build/` is reserved: Loft page paths only allow `[a-z0-9-]` segments, so they can't reach it.

## Related

- Task: tasks/active/serve-app-build-files.md
- Spec: SPEC §5, SPEC §11 "App sites"
- Builds on: [ADR-019](ADR-019-add-an-app-site-kind.md)
