# ADR-009: Email and password sign-in for the MVP

## Status

Accepted

## Date

2026-10-25

## Context

The Loft needs staff sign-in (T10). SPEC §2 locks in Better Auth through `@convex-dev/better-auth`. Milestone 1 is an MVP with a handful of staff, and no email provider is set up yet (Resend arrives with T20).

## Decision

Use Better Auth's built-in email and password sign-in, with no email verification and no password-reset emails for now. Public sign-up is closed. Accounts come from the seed or an existing owner, and the first user becomes owner of the seed site (T10).

## Alternatives Considered

### GitHub or Google OAuth

- Pros: no passwords to store; suits an open-source project
- Cons: an OAuth app to register for every environment before anyone can sign in
- Deferred: planned as extra providers later

### Magic links

- Pros: no passwords
- Cons: needs a working email provider first
- Deferred: until Resend is set up

## Consequences

- The only setup is `BETTER_AUTH_SECRET` and `SITE_URL` on each Convex deployment.
- Without verification or reset emails, a forgotten password means an owner resets it by hand. That's fine for a few staff, but not for wider use.
- A later "full sign-up" pass adds Google, GitHub and possibly Facebook, email verification, password reset and magic links as Better Auth providers and plugins, without replacing this setup.

## Related

- Task: tasks/someday/add-staff-sign-in.md
- Follow-up: tasks/someday/add-social-sign-in-and-verification.md
