---
title: Fix findings from the publish pipeline review
created: 2026-10-25
completed: 2026-10-25
---

The outside review T13 asked for (`/code-review` on #27) found a crash and four smaller issues, fixed together.

- A draft with no `<head>` crashed publish; a `page-head` house rule now reports it
- Republishing an identical page reused its version with the old date and author; the reuse now counts as the latest publish, found through a `by_page_hash` index
- `loadTheme` cached failed builds forever and only resolved the bare `tailwindcss` import the Convex-safe way; it now retries failures and resolves every `tailwindcss/…` import with `import.meta.resolve`
- Publish checked R2 for the elements script on every page with a form; it now checks once per process
- `buildRelease`'s docstring promised a stable hash it only gives once IDs are saved

Two rare races and a history ordering issue from the same review are in `add-publish-page-lock`.

Related: [T13 plan](../../docs/plans/add-publish-and-rollback.md), `add-publish-and-rollback`
