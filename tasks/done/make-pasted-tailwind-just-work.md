---
title: Make pasted Tailwind HTML just work
created: 2026-10-28
completed: 2026-10-28
plan: docs/plans/make-pasted-tailwind-just-work.md
---

Pasting Tailwind HTML into the Loft should publish without running a Convex command. Today the house rules reset Tailwind's default palette, ban arbitrary values and block on unknown classes, and a site's theme can only be set from the CLI, so a pasted page (like the sample page on prod's `r2c2-site`) fails with "isn't a theme class".

Related: [ADR-004](../../docs/decisions/ADR-004-html-pipeline-libraries.md), [SPEC §12](../../SPEC.md#12-html-house-rules), [add-loft-theme-panel](../someday/add-loft-theme-panel.md)
