---
title: T04 Scaffold the edge Worker
created: 2026-10-24
---

Create `apps/edge`, the Cloudflare Worker that serves published sites.

- `wrangler.jsonc`: R2 binding `SITES`, KV binding `ROUTES`, Workers Cache enabled, Oceania location hint on the bucket
- Local dev with `wrangler dev`; runtime tests with `@cloudflare/vitest-pool-workers` on a package-local Vitest 4

Done when a hello-world gateway and renderer run locally and in a test.

Spec: [SPEC §2, §8](../../SPEC.md)
