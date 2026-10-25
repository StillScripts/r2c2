---
title: Add a skill for resolving merge conflicts
created: 2026-10-25
completed: 2026-10-25
---

Add a `resolve-conflicts` skill so every agent resolves merge conflicts the same way, which lets several PRs run in parallel safely.

- Adapt Warp's `resolve-merge-conflicts` (compact conflict extraction script) for this repo
- Borrow Matt Pocock's rule: understand both sides' intent and never drop behaviour
- Repo rules for the lockfile, generated Convex API and task/docs files; merge, never rebase, pushed branches
- List it in `AGENTS.md` and `.claude/settings.json`; not chained into `handle-task`

Done when the skill is merged and used to resolve PR #20's conflicts.
