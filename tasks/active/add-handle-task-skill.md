---
title: Add handle-task skill
created: 2026-10-24
---

Add a `handle-task` skill that runs one task end to end by chaining the existing skills:
`create-task` → `create-branch` → do the work → `commit` → `/simplify` (commit again if it
changed anything) → move the task to `done/` and commit → `create-pr`. CI failures are
left to `fix-ci`, run on request.

Related: [ADR-001](../../docs/decisions/ADR-001-adopt-and-adapt-agent-skills.md), [ADR-002](../../docs/decisions/ADR-002-use-sentry-naming-conventions.md)
