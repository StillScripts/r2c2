---
title: T05 Spike: prove Workers Cache
created: 2026-10-24
---

Prove Workers Cache does what the edge design needs before building on it.

- Deploy a throwaway Worker and test the three behaviours in SPEC §10: `props` isolate cache entries across hostnames, `ctx.cache.purge({ tags })` clears every location, `s-maxage` is honoured separately from `max-age`
- Record the results and the chosen approach (Workers Cache, or the Cache API fallback) as an ADR with `document-decisions`

Done when the decision is recorded; if the fallback is chosen, update T06 to T08 to match before starting them.

Related: [SPEC §10](../../SPEC.md#10-things-to-prove-early-t05-spike)
