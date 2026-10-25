---
title: T13 Add publish and rollback
created: 2026-10-24
---

Turn a draft into a live page, and undo it.

- Publish action: sanitise, IDs, forms, Tailwind, hash, write version and asset, copy to live, mark live, purge, audit
- When assembling the document, add the doctype, canonical URL, CSS link and the elements script (when the page uses a `PLATFORM_TAGS` element), plus a `sitekey` attribute and a visually hidden honeypot `<input name="website">` on each `<site-form>` ([T18 plan](../../docs/plans/build-site-form-element.md))
- Purge retries through the scheduler; R2 always written before purge; rollback reuses steps 3 to 5

Done when a publish shows up on the local edge, a rollback restores the old page, and a failed purge retries.

Review checkpoint: ask for an outside review of the publish pipeline before T14.

Related: [SPEC §4](../../SPEC.md#4-how-it-works)
