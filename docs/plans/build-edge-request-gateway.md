---
title: T07 Build the gateway
depth: detailed
created: 2026-10-25
---

# T07 Build the gateway

Make the edge's default handler look up each request's hostname in KV and act on the entry: hand live sites to the renderer, redirect redirect-domains, show a holding page for coming-soon sites, and 404 unknown hosts.

## Context

- **Flow (SPEC §4):** normalise the host and path and drop tracking parameters, read `host:<hostname>` from KV, then: unknown host → 404, redirect entry → 301, `coming-soon` → holding page, `live` → call `Renderer` with `props: { siteId }`. Workers Cache keys on path plus props, so two sites' `/about` never share an entry.
- **Code that already exists:**
  - `apps/edge/src/index.ts` normalises the request and passes the hostname as `siteId` (a stand-in until now).
  - `packages/core`: `routeKey`, `routeEntrySchema`/`RouteEntry`, `normaliseHost`, `normalisePath`, `stripTrackingParams`, `notFoundHeaders`.
  - Convex (T12) writes the KV entries; a redirect entry is `{ redirect: "https://<primary>" }`.
- **Bindings:** `ROUTES` (KV) is in `wrangler.jsonc`; tests get a local namespace.

## Approach

`fetch` in `apps/edge/src/index.ts`, in order:

1. **Path:** `normalisePath`; an unsafe path is a 404 before any KV read (as now).
2. **Lookup:** `ROUTES.get(routeKey(host), "json")`, parsed with `routeEntrySchema.safeParse`. A missing key is an unknown host. A malformed entry is logged with `console.error` and treated as unknown, so bad data never reaches the renderer.
3. **Unknown host:** plain-text `404` with `cache-control: no-store`, so a newly added domain works as soon as its KV entry lands.
4. **Redirect:** `301` to the entry's origin with the request's original path and query kept (`https://www.a.com/about?x=1` → `https://a.com/about?x=1`), so deep links survive. Core's `redirectLocation(origin, url)` builds it next to `routeEntries`, and the schema now only accepts a bare origin for `redirect`. `cache-control: public, max-age=3600` so browsers don't pin the redirect forever if domains change.
5. **Coming soon:** a built-in holding page, status `200`, with its own headers (`s-maxage=60`, site tag, CSP) plus `x-robots-tag: noindex`. Core gets `comingSoonHeaders(siteId)`. Switching a site to live shows within about a minute.
6. **Live:** `ctx.exports.Renderer({ props: { siteId: entry.site } })` with the normalised URL, as now.

Only the normalised host is used for the KV key. The `GET`/`HEAD` check (405 otherwise) and stripping the body from `HEAD` move from the renderer to the gateway, so they cover every outcome, not just live pages. The built-in pages and the plain 404 share an edge-local `responses.ts`. The renderer tests call `Renderer` directly; the gateway tests cover routing.

## Alternatives considered

- **Per-site coming-soon page from R2 (`sites/<id>/coming-soon.html`):** nicer branding, but nothing publishes one yet and it adds an R2 key to the contract. Add it with the Loft's site settings.
- **`308` instead of `301`:** keeps the method for POSTs, but SPEC says 301 and only GETs hit redirect domains in practice.
- **Caching unknown-host 404s:** saves KV reads for junk hosts, but delays new domains. KV reads are cheap and cached at the edge by KV itself.

## Scope

- In: KV lookup, unknown/redirect/coming-soon/live handling, `comingSoonHeaders`, `redirectLocation`, the method check at the gateway, tests, replacing the hostname stand-in.
- Out: the forms route `/_api/forms/*` (T21); preview of a coming-soon site for its owner (draft preview links, later); HTTPS redirects (Cloudflare's "Always use HTTPS").

## Action items

- [x] Add `comingSoonHeaders` and `redirectLocation` (origin-only redirect entries) to `packages/core`, with tests
- [x] Gateway in `apps/edge/src/index.ts`: KV lookup and the four outcomes
- [x] Update the edge tests to seed KV, plus the cases below
- [x] Run `vp check`, `vp test`, `vp run build`

## Testing

Workers tests through `exports.default.fetch`, seeding `env.ROUTES` and `env.SITES`:

- **Isolation (done-when):** two hosts mapped to different sites, each with its own `/about`, return their own page, requested back to back in both orders.
- **Unknown host:** 404, `no-store`, and the renderer isn't called (no R2 read needed to prove it: the body is the gateway's).
- **Malformed entry:** 404 like unknown.
- **Redirect:** 301 to the primary with path and query kept; cache header set.
- **Methods:** `HEAD` has no body for live and coming-soon; `POST` is 405 on live, coming-soon and unknown hosts.
- **Coming soon:** 200 holding page with `noindex`, site tag and CSP; a page in R2 for that site isn't served.
- **Live:** the renderer gets the site ID from KV, not the hostname; host case, trailing dot and tracking params still normalise.

## Risks

- **KV propagation:** a new or changed entry can take up to a minute to reach every location. Acceptable, and the same as page freshness.
- **Review checkpoint:** the task asks for an outside review of edge serving (T06 + T07) before T13. After the PR, run `/code-review` on the edge or ask a person.

## Decisions

- No ADR: this follows SPEC §4/§5.
