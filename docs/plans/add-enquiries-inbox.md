---
title: T17 Add the enquiries inbox
depth: simple
created: 2026-10-25
---

# T17 Add the enquiries inbox

Let site members read enquiries in the Loft and mark them handled, with an audit entry.

## Approach

- **Backend (`packages/backend/convex/enquiries.ts`):**
  - `list` (member): `{ siteId, status }`, newest first through a new `by_site_status_created` index, at most 100.
  - `counts` (member): the number of new enquiries, for a badge on the site page. It counts up to 100 and shows "100+" past that.
  - `get` (member): one enquiry through `ownDoc`.
  - `setStatus` (member, so editors can handle enquiries too): `new` ↔ `handled`. It does nothing if the status is unchanged; otherwise it writes the audit entry `enquiry.handled` or `enquiry.reopened` with the enquiry ID as target.
- **Seed:** add one sample enquiry to the seed site if it has none, including on already-seeded deployments, so the inbox has something to show.
- **Loft:**
  - `/sites/$siteId/enquiries`: New and Handled tabs (a `status` search param). Each row shows the form, the first field values, the source page and the received time.
  - `/sites/$siteId/enquiries/$enquiryId`: every field, the source page, the referrer, the campaign (`utm_*` values), the received time, and a "Mark handled" or "Reopen" button.
  - The site page links to the inbox with the new count.
  - A small `lib/enquiry.ts` holds the display helpers (summary line, campaign), with unit tests.

## Scope

- In: the queries and mutation, the index, the seed enquiry, the two Loft routes, the link, tests.
- Out: email (T20); deleting, assigning or replying to enquiries; search; pagination past 100 (later, if sites need it).

## Action items

- [ ] Schema index and `enquiries.list` / `counts` / `get` / `setStatus`, with convex-test coverage (access, filtering, audit, no-op)
- [ ] Seed a sample enquiry
- [ ] Loft list and detail routes, site-page link, display helpers with tests
- [ ] Run `vp check`, `vp test`, `vp run build`

## Decisions

- No ADR: this follows SPEC §6.
