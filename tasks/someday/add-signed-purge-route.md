---
title: T08 Add the signed purge route
created: 2026-10-24
---

Let the backend clear cached pages after a publish.

**Parked by [ADR-011](../../docs/decisions/ADR-011-workers-cache-without-purge.md):** `ctx.cache.purge` reported success but cleared nothing in the T05 spike, so milestone 1 relies on the 60 s `s-maxage` instead. Pick this up only if the custom-domain re-test at T23 shows purge working.

- `POST /_internal/purge` with the signing scheme; purges `site-*` or `page-*` tags in the renderer

Done when unsigned, stale and tampered requests get 401, and a valid one clears a cached page.

Related: [SPEC §5](../../SPEC.md#5-contracts-packagescore)
