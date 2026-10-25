---
title: Run tasks by dragging them on the roadmap board
created: 2026-10-25
---

Make the docs site's `/roadmap/` board drive the work when the repo runs locally. Dragging a card from Someday to Active moves its file from `tasks/someday/` to `tasks/active/`, and a running Claude session notices the move, asks whether to start on it, and can hand it to a subagent that runs `handle-task`. Then the roadmap becomes something you can work from, not only read.

- In dev only: the board is read-only now, so the dev server needs a route that moves task files, and the board needs drag and drop
- A running session watches `tasks/active/`, for example with a hook or `Monitor`, and asks before it starts anything
- Keep the one-active-task rule: refuse a drop when `active/` already holds a task
- Later, maybe: the same flow on the deployed site, which needs auth and a way to reach a session

Related: [ADR-013](../../docs/decisions/ADR-013-build-docs-site-with-starlight.md), #28
