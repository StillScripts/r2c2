---
title: Clean up the Convex schema
created: 2026-10-25
---

Collect schema and backend tidy-ups here and do them together once there's enough to justify a pass.

- **One source for the page title:** `pages.title` duplicates the `<title>` in `draftHtml`, where T11 put page metadata. Either fill `title` from the draft's `<title>` on every save and treat it as a list label only, or drop the field.
- **Separate storage per environment:** Convex IDs differ between dev and production (ADR-008), so the dev deployment should use its own R2 bucket and KV namespace. T12 sets that up; check the docs and env examples say so.
- **A seed that passes the house rules:** the seed page has empty `draftHtml` and the seed theme has no component classes (`btn`, `card`, `section`, `prose`). A minimal valid page and theme would let the local edge render something before T22.

Related: [ADR-005](../../docs/decisions/ADR-005-persist-random-element-ids.md), [ADR-008](../../docs/decisions/ADR-008-use-convex-ids-as-site-ids.md), [T11 plan](../../docs/plans/build-html-pipeline-package.md)
