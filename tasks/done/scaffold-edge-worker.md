---
title: T04 Scaffold the edge Worker
created: 2026-10-24
completed: 2026-10-24
---

Create `apps/edge`, the Cloudflare Worker that serves published sites.

- `wrangler.jsonc`: R2 binding `SITES`, KV binding `ROUTES`, Workers Cache enabled, Oceania location hint on the bucket
- Local dev with `wrangler dev`; runtime tests with `@cloudflare/vitest-plugin` under `vp test` (the renamed `@cloudflare/vitest-pool-workers`, which now supports Vitest 5)

Done when a hello-world gateway and renderer run locally and in a test.

Related: [SPEC §2](../../SPEC.md#2-locked-decisions), [SPEC §8](../../SPEC.md#8-environments-and-secrets)
