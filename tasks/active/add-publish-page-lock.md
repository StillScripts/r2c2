---
title: Serialise publish and rollback per page
created: 2026-10-25
---

The publish pipeline review found races that a short per-page lock would close. Do it before many staff publish at once.

- Two pages publishing at the same moment with clashing forms: the live copy is already in R2 when `markLive` refuses the second, so the edge serves a form intake rejects
- A publish and a rollback of one page at the same moment can land in a different order in R2 and in Convex, so the edge and `liveVersionId` disagree
- A save during a publish leaves the publish snapshot of the older draft as the newest history entry

Likely shape: a mutation claims the page (with an expiry) before any R2 write, checks form clashes against the registry inside that mutation, and `markLive` / `markRolledBack` release it; a second publish or rollback of a claimed page is refused with a readable error.

Related: [T13 plan](../../docs/plans/add-publish-and-rollback.md) (Risks), `fix-publish-review-findings`
