---
title: T17 Add the enquiries inbox
depth: simple
created: 2026-10-25
---

# T17 Add the enquiries inbox

Let site members read enquiries in the Loft and mark them handled, with an audit entry.

## Approach

- **Backend (`packages/backend/convex/enquiries.ts`):**
  - `list` (member): `{ siteId, status }` → `{ enquiries, capped }`, newest first through a new `by_site_status_created` index (replacing the unused `by_site_created`; SPEC §6 updated), at most 100, with `capped` when there are more.
  - `newCount` (member): `{ count, capped }` for a badge on the site page ("100+ new" when capped).
  - `get` (member): one enquiry through `ownDoc`.
  - `setStatus` (member, so editors can handle enquiries too): `new` ↔ `handled`. It does nothing if the status is unchanged; otherwise it writes the audit entry `enquiry.handled` or `enquiry.reopened` with the enquiry ID as target.
- **Seed:** add one sample enquiry (with a real dedupe hash) to the seed site if it has none, including on already-seeded deployments, so the inbox has something to show.
- **Loft:**
  - `/sites/$siteId/enquiries`: New and Handled tabs (a `status` search param). Each row shows the form, the first field values, the source page and the received time.
  - `/sites/$siteId/enquiries/$enquiryId`: every field, the source page, the referrer, the campaign (`utm_*` values), the received time, and a "Mark handled" or "Reopen" button.
  - The site page links to the inbox with the new count.
  - The display helpers (`enquirySummary`, `enquiryCampaign`) live in core, with unit tests, so email (T20) can reuse them.

## Scope

- In: the queries and mutation, the index, the seed enquiry, the two Loft routes, the link, tests.
- Out: email (T20); deleting, assigning or replying to enquiries; search; pagination past 100 (later, if sites need it).

## Action items

- [x] Schema index and `enquiries.list` / `newCount` / `get` / `setStatus`, with convex-test coverage (access, filtering, audit, no-op)
- [x] Seed a sample enquiry
- [x] Loft list and detail routes, site-page link; display helpers in core with tests
- [x] Run `vp check`, `vp test`, `vp run build`

## Decisions

- No ADR: this follows SPEC §6.
