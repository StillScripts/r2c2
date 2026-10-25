---
title: Add Convex agent skills
created: 2026-10-25
---

Give agents current Convex knowledge instead of stale training data: Convex's skills at the repo root, and its generated `guidelines.md` in `packages/backend`.

- Waiting on: `convex/_generated/ai/guidelines.md`, which downloads from `version.convex.dev` (blocked in cloud sessions); run `npx convex ai-files install` in `packages/backend` locally and commit it

Related: [ADR-014](../../docs/decisions/ADR-014-install-convex-skills-at-root.md)
