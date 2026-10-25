---
title: Add a Starlight docs site
created: 2026-10-25
completed: 2026-10-25
---

Add `apps/docs`, an Astro Starlight site for the project's coding docs. On dev and build
it copies (never moves) `docs/plans`, `docs/decisions` and `tasks/` into the site: plans
and decisions render as Markdown in their own sidebar groups, and tasks render as a
roadmap page and a completed page styled after the task-management dashboard. Not
deployed yet; publishing is `publish-docs-site-on-r2c2`.

Related: [ADR-013](../../docs/decisions/ADR-013-build-docs-site-with-starlight.md), `publish-docs-site-on-r2c2`, `launch-open-source-repo`
