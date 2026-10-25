# ADR-011: Workers Cache without purge for milestone 1

## Status

Accepted

## Date

2026-10-25

## Context

The edge design (SPEC §4) caches rendered pages with Workers Cache: the gateway calls the renderer with `props: { siteId }`, and Cloudflare caches the result keyed on path and props. After a publish, Convex was to call a signed purge route (T08) that runs `ctx.cache.purge({ tags })`.

The T05 spike (`apps/edge/spike/`, run on `workers.dev` from Australia, results in `tasks/done/spike-workers-cache-behaviour.md`) found:

- **Works:** caching (`MISS` then `HIT`), per-site isolation through `props` on the same path, and `s-maxage` applying at the edge while browsers still get `max-age`.
- **Doesn't work:** `ctx.cache.purge({ tags })` returned `{ success: true, errors: [] }` for both `page-<id>` and `site-<id>` tags, but the page was still a `HIT` with the same render 30 s later.
- **Untested:** a custom domain on a Cloudflare zone, and more than one location.

## Decision

Keep Workers Cache for caching and don't purge in milestone 1. Pages keep `public, max-age=0, s-maxage=60, stale-while-revalidate=86400` (SPEC §5), so a publish or rollback shows up at the edge once the cached copy expires. That's within about a minute. With `stale-while-revalidate`, the first request after expiry may still get the old page while the cache refreshes. The signed purge route (T08) is parked, and publish (T13) has no purge step.

## Alternatives Considered

### Re-test on a custom domain before deciding

- Pros: purge might work on a zone, keeping instant updates
- Cons: blocks the edge track on a domain that isn't chosen yet
- Deferred: planned as a check during `deploy-to-production`, using the same spike kit

### Cache API with zone purge by tag

- Pros: instant updates through Cloudflare's purge-by-tag API, called from Convex
- Cons: more renderer code (manual `match`/`put`), a cache per location, and it needs a real zone even in dev
- Rejected for now: a minute of staleness is acceptable for an MVP

## Consequences

- Edge tasks (T06, T07) go ahead on the SPEC §4 design without a purge route, and the review checkpoint moves from T08 to T07.
- Editors may see the old page for up to about a minute after publishing. The Loft should say so.
- `EDGE_PURGE_URL` and the Convex → Worker signed purge request aren't needed until purge returns.
- The spike kit stays in `apps/edge/spike/` for the custom-domain re-test at T23. If purge works there, T08 comes back.

## Related

- Spike results: tasks/done/spike-workers-cache-behaviour.md
- Parked: tasks/someday/add-signed-purge-route.md
