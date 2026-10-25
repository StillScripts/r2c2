---
title: Choose the Convex region
created: 2026-10-24
completed: 2026-10-25
---

Chose US East (N. Virginia), recorded in ADR-007, and connected `packages/backend` to the dev deployment `tangible-bear-808`. Revisit the region for production.

- Record the choice with `document-decisions`
- Add `convex` to `packages/backend` and point it at the dev deployment
- Add `packages/backend/.env.example`; fill in local env files for the backend, Loft and edge

Needed for `add-convex-backend-schema` (T09).

Related: [ADR-007](../../docs/decisions/ADR-007-run-convex-in-us-east.md)
