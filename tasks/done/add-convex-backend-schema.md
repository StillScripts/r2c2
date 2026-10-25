---
title: T09 Add the Convex backend and schema
created: 2026-10-24
completed: 2026-10-25
plan: docs/plans/add-convex-backend-schema.md
---

Added the SPEC §6 schema, `siteQuery`/`siteMutation`, `ownDoc`, the audit helper and the r2c2 seed in `packages/backend`, with convex-test coverage. The public site ID is the Convex document ID (ADR-008).

- Tables and indexes in SPEC §6
- `siteQuery` and `siteMutation` helpers that load the site and check membership; audit log helper
- Seed script creating the `r2c2` site, its domains and an empty home page

Done when convex-test covers membership checks and cross-site access is refused.

Related: [SPEC §6](../../SPEC.md#6-data-model-convex-milestone-1), `choose-convex-deployment-region`
