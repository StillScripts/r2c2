---
title: Connect the local edge to the dev bucket and namespace
created: 2026-10-25
---

`wrangler dev` gives the edge Worker simulated, empty KV and R2, so it never sees what the Convex dev deployment writes to `r2c2-dev` and `R2C2_ROUTES_DEV`. Until it does, a local request to `r2c2.localhost` finds no route.

- Add a `dev` environment to `apps/edge/wrangler.jsonc` with remote bindings: `SITES` → `r2c2-dev`, `ROUTES` → the `R2C2_ROUTES_DEV` namespace ID, both `"remote": true`
- Point the edge's `dev` script at `wrangler dev --env dev`; keep the top-level bindings local so tests stay offline
- Document `wrangler login` and the KV delay (a new domain can take up to ~60s to appear) in the edge README

Do before or alongside T06 (`build-edge-page-renderer`), the first task that serves what Convex publishes. Production bindings (`r2c2-sites`, a production namespace ID) belong to `deploy-to-production`.

Done when a seeded site resolves through the local Worker against the dev namespace.

Related: [SPEC §4](../../SPEC.md#4-how-it-works), [SPEC §8](../../SPEC.md#8-environments-and-secrets), [ADR-008](../../docs/decisions/ADR-008-use-convex-ids-as-site-ids.md), #14
