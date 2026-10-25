---
title: T06 Build the renderer
depth: detailed
created: 2026-10-25
---

# T06 Build the renderer

Replace the edge's placeholder `Renderer` with one that serves published pages, hashed assets and the shared elements script from R2, with the SPEC §5 headers and a per-site 404.

## Context

- **Flow (SPEC §4):** the gateway normalises the host and path, then calls `Renderer` with `props: { siteId }`. Workers Cache keys on path plus props, so a hit never reaches the renderer. On a miss, the renderer reads R2 and returns the response with headers that tell the cache how long to keep it.
- **Code that already exists:**
  - `apps/edge/src/index.ts` has the gateway and a placeholder `Renderer` that echoes `siteId` and path.
  - Until T07 the gateway passes the hostname as `siteId`; T07 swaps that for the KV lookup. T06 doesn't touch the gateway.
  - `packages/core` has the R2 key builders (`liveKey`, `assetKey`, `notFoundKey`, `elementsKey`) and the headers (`pageHeaders`, `notFoundHeaders`, `ASSET_HEADERS`).
  - The HTML pipeline (T11) only allows media at `/assets/<hash>.<ext>` (`MEDIA_PREFIX`).
- **Cache (ADR-011):** no purge. Pages expire at the edge after `s-maxage=60`.
- **Bindings:** `SITES` (R2) and `ROUTES` (KV) are in `wrangler.jsonc`. Tests run in workerd through `@cloudflare/vitest-plugin`, with a local R2 bucket.

## Approach

### URLs the renderer answers

| Request path            | R2 key                                  | Headers                                                |
| ----------------------- | --------------------------------------- | ------------------------------------------------------ |
| `/assets/<hash>.<ext>`  | `sites/<siteId>/assets/<hash>.<ext>`    | `ASSET_HEADERS`, the content type for `ext`, `nosniff` |
| `/_elements/<hash>.js`  | `shared/elements/<hash>.js`             | `ASSET_HEADERS`, `text/javascript`, `nosniff`          |
| anything else           | `sites/<siteId>/live/<path>/index.html` | `pageHeaders`                                          |
| page or asset not in R2 | `sites/<siteId>/404.html`               | `notFoundHeaders`, status 404                          |

- **Elements URL:** `/_elements/<hash>.js` is new. The script must be same-origin for the CSP, and the underscore matches the reserved `/_api/` prefix. Core gets `ELEMENTS_PREFIX = "/_elements/"` and `MEDIA_PREFIX` moves to core as `ASSETS_PREFIX`, re-exported by `packages/html`, so T13 and the renderer build URLs from one place.
- **Asset paths:** they must match `<16 hex>.<ext>`, the shape `hashContent` produces. Anything else under those prefixes is a 404 without an R2 read.
- **Content types:** a small map in the renderer: `css`, `js`, `webp`, `avif`, `png`, `jpg`/`jpeg`, `gif`, `ico`, `woff2`. Unknown extensions are a 404. SVG is left out for now: it can carry script and would run on the site's origin.

### Page headers

`pageHeaders` needs `pageId` and the version `hash`. T13 will write both as R2 custom metadata on the live copy (`{ pageId, hash }`); core exports a `LivePageMetadata` type for that contract. If the metadata is missing, the page is still served: the cache tag is just `site-<id>` and the etag falls back to R2's own etag.

### Behaviour

- **Methods:** `GET` and `HEAD` only; `HEAD` returns the headers without a body. Anything else gets `405` with `allow: GET, HEAD`.
- **Streaming:** the R2 body is returned as-is, not buffered.
- **Conditional requests:** a page `GET` whose `if-none-match` equals the etag gets `304` with the same headers. Assets don't need it; they're immutable.
- **404:** the site's `404.html` with `notFoundHeaders` and status 404. If the site has none, a built-in minimal page with the same headers.
- **Errors:** an R2 failure throws, so Workers returns a 500 that isn't cached.

### Code layout

- `apps/edge/src/renderer.ts`: the `Renderer` entrypoint and its helpers, moved out of `index.ts`, which keeps the gateway and re-exports `Renderer` (Workers needs it exported from the main module).
- `packages/core`: `ELEMENTS_PREFIX`, `ASSETS_PREFIX`, `LivePageMetadata`, with tests.

## Alternatives considered

- **Shared elements under `/assets/`:** it would mix a cross-site file into a per-site path, and the renderer would need a special case for one hash. A separate prefix is clearer.
- **Pages' etag from R2's etag only:** simpler, but SPEC §5 says the etag is the version hash, which is stable across rollbacks to the same version.
- **Serving SVG with a locked-down CSP:** possible, but nothing uploads SVG yet. Add it with media uploads.

## Scope

- In: the renderer, the asset and elements routes, page and 404 headers, the core prefixes and metadata type, tests.
- Out:
  - the KV lookup, redirects and coming-soon (T07)
  - writing pages, metadata and assets to R2 (T13)
  - the forms route (T21)
  - rejecting page paths under `/assets/` or `/_elements/` in the Loft (T15)

## Action items

- [ ] Add `ASSETS_PREFIX`, `ELEMENTS_PREFIX` and `LivePageMetadata` to `packages/core`; re-export the assets prefix from `packages/html` as `MEDIA_PREFIX`
- [ ] Write `apps/edge/src/renderer.ts`: route by prefix, read R2, headers, `HEAD`, `304`, `405`, 404 fallback
- [ ] Keep the gateway in `index.ts` and re-export `Renderer`
- [ ] Tests below; run `vp check`, `vp test`, `vp run build`

## Testing

Workers tests through the gateway (`exports.default.fetch`), seeding the local R2 bucket with `env.SITES.put`. The host stands in for `siteId` until T07, and each test uses its own path so Workers Cache can't serve one test's response to another.

- **Hit:** a seeded page returns 200, its body, every SPEC §5 page header, the cache tag with page ID and the etag from metadata. `/about/` and `/About` read `live/about/index.html`.
- **Missing metadata:** the page is served with the site tag only and R2's etag.
- **Miss:** the site's `404.html` with status 404 and `notFoundHeaders`; without one, the built-in page.
- **Assets:** a CSS and a WebP asset return the immutable headers and the right content type; another site's asset with the same hash isn't served; a malformed name or unknown extension is a 404.
- **Elements:** `/_elements/<hash>.js` serves the shared script as JavaScript, immutable.
- **Methods:** `HEAD` has headers and no body; `POST` is 405; a matching `if-none-match` is 304.

## Risks

- **Workers Cache in tests:** if the local cache is on, a repeated path returns a cached response. Unique paths per test avoid it; if that isn't enough, turn caching off in the test config.
- **Metadata contract with T13:** the type in core is the contract; T13 must write it on every live copy.

## Decisions

- No ADR: this follows SPEC §4/§5. The `/_elements/` prefix is a small URL contract, recorded in core and here; revisit if more platform URLs appear.
