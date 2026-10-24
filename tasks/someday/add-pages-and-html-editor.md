---
title: T15 Add pages and the HTML editor
created: 2026-10-24
---

Let staff create and edit pages without publishing.

- Pages list per site; create a page; HTML source editor with a live preview in a sandboxed `srcdoc` iframe using compiled CSS
- Draft saves to `pages.draftHtml`; install `@convex-dev/table-history` as `pageHistory` and record snapshots through `recordDraft()` per SPEC §6

Done when a page can be created, edited and previewed without publishing, and a test shows snapshots recorded on the right events only.

Related: [SPEC §4](../../SPEC.md#4-how-it-works), [SPEC §6](../../SPEC.md#6-data-model-convex-milestone-1)
