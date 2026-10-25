---
title: T21 Add the gateway forms route
created: 2026-10-24
completed: 2026-10-25
plan: docs/plans/add-gateway-forms-route.md
---

Take form posts at the edge and forward them to Convex.

- `POST /_api/forms/:form`: size limit, rate limit, Turnstile, site from hostname, zod validation, sign, forward to Convex
- HTML form posts get a 303 back to the page with `?sent=<form>`
- Form-encoded posts without a Turnstile token are accepted only when the `website` honeypot is empty, at a lower rate limit, with `_source` optional ([T18 plan](../../docs/plans/build-site-form-element.md))

Done when an end-to-end test submits the form on a local site and the enquiry lands in the Loft inbox.

Review checkpoint: ask for an outside review of the enquiry path before T22.

Related: [SPEC §4](../../SPEC.md#4-how-it-works), [SPEC §5](../../SPEC.md#5-contracts-packagescore), [SPEC §7](../../SPEC.md#7-security-rules)
