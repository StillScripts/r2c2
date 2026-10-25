---
title: T12 Add R2 writes and KV sync
created: 2026-10-24
completed: 2026-10-25
plan: docs/plans/add-r2-writes-kv-sync.md
---

Connect Convex to the edge's storage.

- Convex actions writing to R2 through `@convex-dev/r2`
- KV writes through the Cloudflare API when domains change

Done when a domain added in Convex appears in KV and a test object round-trips through R2.

Related: [SPEC §5](../../SPEC.md#5-contracts-packagescore), [SPEC §8](../../SPEC.md#8-environments-and-secrets)
