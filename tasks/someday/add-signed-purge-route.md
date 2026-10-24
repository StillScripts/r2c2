---
title: T08 Add the signed purge route
created: 2026-10-24
---

Let the backend clear cached pages after a publish.

- `POST /_internal/purge` with the signing scheme; purges `site-*` or `page-*` tags in the renderer

Done when unsigned, stale and tampered requests get 401, and a valid one clears a cached page.

Review checkpoint: ask for an outside review of the edge before T09.

Related: [SPEC §5](../../SPEC.md#5-contracts-packagescore)
