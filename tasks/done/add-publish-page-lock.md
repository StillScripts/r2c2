---
title: Serialise publish and rollback per page
created: 2026-10-25
completed: 2026-10-26
---

Publish and rollback claim their page in `pageClaims` before any R2 write and let it go when they end, so the races the publish pipeline review found are closed:

- A second publish or rollback of a claimed page is refused as `page_busy`, so R2 and `liveVersionId` can't land in different orders
- Form clashes are checked inside the claiming mutation against other pages' live versions and the forms on their claims, so two pages can't both put a clashing form in R2
- `writeDraft` refuses while the page is claimed, so a save can't land between a publish's build and its snapshot

A claim expires after two minutes (`CLAIM_MS`) if its action dies.

Related: [T13 plan](../../docs/plans/add-publish-and-rollback.md) (Risks), `fix-publish-review-findings`
