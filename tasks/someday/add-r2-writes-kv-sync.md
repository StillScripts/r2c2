---
title: T12 Add R2 writes and KV sync
created: 2026-10-24
---

Connect Convex to the edge's storage.

- Convex actions writing to R2 through `@convex-dev/r2`
- KV writes through the Cloudflare API when domains change

Done when a domain added in Convex appears in KV and a test object round-trips through R2.

Spec: [SPEC §5, §8](../../SPEC.md)
