---
title: T19 Add enquiry intake in Convex
created: 2026-10-24
---

Accept signed enquiries from the edge and store them.

- HTTP action verifying the signature; field check against the form registry; dedupe; rate limiter component; internal mutation stores the enquiry

Done when tests reject unsigned, stale, unknown-form and extra-field requests.

Spec: [SPEC §5, §7](../../SPEC.md)
