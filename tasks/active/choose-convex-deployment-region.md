---
title: Choose the Convex region
created: 2026-10-24
---

Pick where the Convex deployment runs, and connect this repo to the dev deployment. Sydney adds 30% but sits next to Australian users and the team.

- Record the choice with `document-decisions`
- Add `convex` to `packages/backend` and point it at the dev deployment
- Add `packages/backend/.env.example`; fill in local env files for the backend, Loft and edge

Needed for `add-convex-backend-schema` (T09).

Related: [ADR-007](../../docs/decisions/ADR-007-run-convex-in-us-east.md)
