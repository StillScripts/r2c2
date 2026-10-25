---
title: Add Convex agent skills and the Convex plugin
created: 2026-10-25
---

Give agents current Convex knowledge instead of stale training data. Follow Convex's own setup: `npx convex ai-files install` in `packages/backend` adds its guidelines, 32 agent skills and pointer files, and the Convex Claude Code plugin is enabled for the project. TanStack Start ships its own skills inside its npm packages; no skill was found for Convex with TanStack Start specifically.

- Waiting on: `convex/_generated/ai/guidelines.md`, which downloads from `version.convex.dev` (blocked in cloud sessions); run `npx convex ai-files install` in `packages/backend` locally and commit it

Related: [ADR-014](../../docs/decisions/ADR-014-let-convex-manage-its-agent-files.md)
