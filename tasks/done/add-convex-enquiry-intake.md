---
title: T19 Add enquiry intake in Convex
created: 2026-10-24
completed: 2026-10-25
plan: docs/plans/add-convex-enquiry-intake.md
---

Accept signed enquiries from the edge and store them.

- HTTP action verifying the signature; field check against the form registry; dedupe; rate limiter component; internal mutation stores the enquiry

Done when tests reject unsigned, stale, unknown-form and extra-field requests.

Related: [SPEC §5](../../SPEC.md#5-contracts-packagescore), [SPEC §7](../../SPEC.md#7-security-rules)
