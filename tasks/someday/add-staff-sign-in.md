---
title: T10 Add staff sign-in
created: 2026-10-24
---

Let staff sign in and limit them to their own sites.

- Better Auth through `@convex-dev/better-auth` with email and password, no verification or reset emails, and public sign-up closed ([ADR-009](../../docs/decisions/ADR-009-email-password-sign-in-for-mvp.md))
- `memberships` with owner and editor roles; first user becomes owner of the seed site

Done when signed-out calls and calls for another site are rejected in tests.

Related: [SPEC §2](../../SPEC.md#2-locked-decisions), [SPEC §7](../../SPEC.md#7-security-rules), [ADR-009](../../docs/decisions/ADR-009-email-password-sign-in-for-mvp.md)
