---
title: T13 Add publish and rollback
created: 2026-10-24
completed: 2026-10-25
plan: docs/plans/add-publish-and-rollback.md
---

Turn a draft into a live page, and undo it.

- Publish action: sanitise, IDs, forms, Tailwind, hash, write version and asset, copy to live, mark live, audit (no purge: the page refreshes within the 60 s `s-maxage`, [ADR-011](../../docs/decisions/ADR-011-workers-cache-without-purge.md))
- When assembling the document, add the doctype, canonical URL, CSS link and the elements script (when the page uses a `PLATFORM_TAGS` element), plus a `sitekey` attribute and a visually hidden honeypot `<input name="website">` on each `<site-form>` ([T18 plan](../../docs/plans/build-site-form-element.md))
- R2 is always written before the version is marked live; rollback reuses the same steps with an older version

Done when a publish shows up on the local edge once the cache expires, and a rollback restores the old page.

Review checkpoint: ask for an outside review of the publish pipeline before T14.

Related: [SPEC §4](../../SPEC.md#4-how-it-works)
