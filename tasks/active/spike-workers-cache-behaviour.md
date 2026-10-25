---
title: T05 Spike: prove Workers Cache
created: 2026-10-24
---

Prove Workers Cache does what the edge design needs before building on it.

- Deploy a throwaway Worker and test the three behaviours in SPEC §10: `props` isolate cache entries across hostnames, `ctx.cache.purge({ tags })` clears every location, `s-maxage` is honoured separately from `max-age`
- Kit: `apps/edge/spike/` (`vp run spike:deploy`, `spike:check`, `spike:delete`); run on a real account and paste the output
- Record the results and the chosen approach (Workers Cache, or the Cache API fallback) as an ADR with `document-decisions`

Done when the decision is recorded; if the fallback is chosen, update T06 to T08 to match before starting them.

## Results (2026-10-25)

Ran on `r2c2-cache-spike.stillscripts.workers.dev`, from one location in Australia:

```
PASS  responses are cached at all
PASS  props isolate sites (same path, different siteId)
FAIL  ctx.cache.purge clears the tagged page
PASS  purge only reaches the calling site (same tag, other props kept)
PASS  s-maxage (5s) applies at the edge despite max-age=3600
PASS  browser still gets max-age=3600
```

- **Caching and isolation work.** The first request is a `MISS`, the repeat is a `HIT` with the same render, and the same path for another `siteId` gets its own entry.
- **`s-maxage` works.** A page with `max-age=3600, s-maxage=5` showed `EXPIRED` and rendered again after 7s, and the browser still got `max-age=3600`.
- **Purge by tag does nothing.**
  - `ctx.cache.purge({ tags: ["page-<id>"] })` returned `{ success: true, errors: [] }`, but the page was still a `HIT` with the same render 2s later.
  - It was still the same render 30s later, inside the page's 60s `s-maxage`.
  - Purging `site-<id>` instead behaved the same, still cached 20s later.
  - The tags match `pageHeaders()` (`site-<id>,page-<id>`). Cloudflare strips `cache-tag` from responses, so clients never see it.
  - The "purge only reaches the calling site" PASS means nothing on its own, since the purge cleared nothing.
- **Untested:** the run used workers.dev, not a custom domain on a Cloudflare zone (production serves sites on custom domains), and only one location.

Related: [SPEC §10](../../SPEC.md#10-things-to-prove-early-t05-spike)
