---
title: T10 Add staff sign-in
depth: detailed
created: 2026-10-25
decisions:
  - docs/decisions/ADR-009-email-password-sign-in-for-mvp.md
---

# T10 Add staff sign-in

Wire Better Auth into the Convex backend through `@convex-dev/better-auth`, with email and
password sign-in and public sign-up closed (ADR-009). Staff accounts are created from the
CLI by an internal action, and the first account on a site becomes its owner. The access
helpers from T09 already check membership, so signed-in calls start working once Convex
trusts Better Auth's tokens.

## Context

- T09 built `siteQuery` and `siteMutation` (`packages/backend/convex/access.ts`) on
  `ctx.auth.getUserIdentity()` alone. `memberships.userId` holds `identity.subject`, which
  with `@convex-dev/better-auth` is the Better Auth user ID, so no migration is needed.
- There is no `auth.config.ts` yet, so deployed functions see every caller as signed out.
  `access.test.ts` already proves signed-out calls and calls for another site are
  refused, using `t.withIdentity`.
- SPEC §2 pins `@convex-dev/better-auth` 0.12.5 and `better-auth` ~1.6.33 (the component
  allows `<1.7.0`). Better Auth declares a `vitest` 2–4 peer, so the workspace allows
  vitest 5 for it, as SPEC §2 says.
- `BETTER_AUTH_SECRET` and `SITE_URL` (`http://localhost:3000`, the Loft) are set on the
  dev deployment.
- `emailAndPassword.disableSignUp` makes Better Auth refuse `signUpEmail` everywhere,
  including server-side calls, so it can't be the only switch if the backend still
  needs to create accounts.

## Approach

**Component.** `convex.config.ts` adds `app.use(betterAuth)`. `convex/auth.ts` holds
`authComponent = createClient(components.betterAuth)` and `createAuth(ctx, { signUp })`,
which builds Better Auth with:

- `baseURL: SITE_URL`, `secret: BETTER_AUTH_SECRET` (read from the environment), and
  `trustedOrigins: [SITE_URL]`;
- `database: authComponent.adapter(ctx)`;
- `emailAndPassword: { enabled: true, disableSignUp: !signUp }`, with no verification or
  reset emails;
- the `convex({ authConfig })` plugin, which issues the JWT that Convex checks.

`signUp` defaults to `false`. Only the internal staff action passes `true`, so the public
`/api/auth/sign-up/email` route always refuses.

**Token checks.** `convex/auth.config.ts` exports
`{ providers: [getAuthConfigProvider()] }`, so Convex verifies the JWT against the
component's JWKS route. `convex/http.ts` registers Better Auth's routes with
`authComponent.registerRoutes(http, createAuth)`. Its CORS is left off: the Loft calls
these routes through its own server in T11.

**Accounts.** The internal action `staff:create`
(`{ email, name, password, site?: slug, role?: Role }`) does four things:

1. finds the site by slug, defaulting to `r2c2` (the seed), through an internal query. It
   refuses an unknown slug before anything is written, so a failed call leaves no
   orphaned user;
2. looks the email up in the component's `user` table, and if it's already there,
   reuses that user and skips sign-up, which lets one person join several sites;
3. otherwise builds `createAuth(ctx, { signUp: true })` and calls `auth.api.signUpEmail`;
4. calls the internal mutation `staff:addMember`.

`addMember` refuses an existing membership. The role is `owner` when the site has no
members yet, otherwise the `role` passed in, defaulting to `editor`. It writes the audit
entry straight to `auditLog` with `actor: "system"`, since `audit()` needs a signed-in
member. Run it with `vp exec convex run staff:create '{…}'` from `packages/backend`, and
document that. Creating accounts from the Loft, by an owner, comes later. It's a public
action wrapping the same steps, so it isn't built here.

**Current user.** `convex/staff.ts` also exports the query `me`, which returns the signed-in
user's name and email (from `authComponent.safeGetAuthUser`) and memberships (site ID, name and role), or `null` when signed out. The
Loft needs it in T11. It reads memberships through the `by_user_site` index prefix.

## Alternatives considered

- `databaseHooks.user.create.before` that blocks sign-ups unless a flag is set: the same
  outcome, but the guard is less obvious than `disableSignUp` and harder to test.
- A trigger on the component's `user` table (`onCreate`) to grant the first membership:
  more plumbing (`authFunctions`, `triggersApi`), and the action already knows the site.
- Better Auth's `admin` plugin `createUser`: adds roles and tables we don't use, and
  memberships already hold roles.

## Scope

- In: dependencies and catalog pins; `convex.config.ts`; `auth.ts`, `auth.config.ts` and
  `http.ts`; `staff.ts` (`create`, `addMember` and `me`); tests; backend README and
  `.env.example`; regenerating `_generated`.
- Out: Loft sign-in pages and the auth client (T11), owners creating staff from the Loft,
  social sign-in, verification and reset emails (`add-social-sign-in-and-verification`),
  the MCP plugin, and production secrets (`deploy-to-production`).

## Action items

- [x] Pin `@convex-dev/better-auth` 0.12.5 and `better-auth` 1.6.33 in the catalog, add
      them to `packages/backend`, and allow `better-auth>vitest` 5 in
      `peerDependencyRules`.
- [x] Register the component in `convex.config.ts`, and add `auth.ts`, `auth.config.ts`
      and `http.ts` as above. Register it in `test/setup.ts` too, and prove `t.fetch`
      reaches Better Auth before writing `staff.ts`.
- [x] Add `staff.ts` with `create` (internal action), `addMember` (internal mutation) and
      `me` (query).
- [x] Push to the dev deployment (`vp run --filter @workspace/backend dev`, once) to
      regenerate `_generated` and check that the deploy succeeds with the env set.
- [x] Add tests in `staff.test.ts` (see Testing).
- [x] Update the backend README (creating staff, the env vars) and `.env.example`.
- [x] Manual check on dev: create an account with `staff:create`, then `curl` the
      sign-in route and the sign-up route on the `.convex.site` URL.
- [x] Run `vp check` and `vp test`.

## Testing

Unit tests run in `convex-test`, which can't verify JWTs, so they combine
`t.withIdentity` with real Better Auth calls:

- `staff:create` makes a user in the component and an `owner` membership on the seed
  site. A second call makes an `editor`. A role passed in is used for later members.
- `staff:create` for an existing member is refused, and an existing user joins another
  site without a second account.
- An unknown site slug is refused, and no user is created.
- `POST /api/auth/sign-up/email` through `t.fetch` is refused with
  `EMAIL_PASSWORD_SIGN_UP_DISABLED`.
- `POST /api/auth/sign-in/email` with the created account's password succeeds, and fails
  with a wrong one.
- `me` returns `null` signed out, and lists only the caller's memberships when signed in
  with that user's ID as `subject`.
- The existing `access.test.ts` already covers signed-out callers and other sites. It
  stays as it is.

End to end, with a real token reaching a `siteQuery`, is checked by hand on dev here, and
in the browser in T11.

## Risks

- **Password hashing in Convex's runtime.** Better Auth's scrypt may be slow or
  unsupported there. Mitigation: the component's docs run it in the default runtime. If
  it fails, move `staff:create` to `"use node"`.
- **`t.fetch` with Better Auth in `convex-test`** may not work (cookies, JWKS key
  generation). Mitigation: fall back to calling `createAuth(ctx).api.signInEmail` inside
  `t.action`, and say so in the PR.
- **`SITE_URL` mismatch.** A wrong `SITE_URL` breaks origin checks and cookies.
  Mitigation: the README notes it must be the Loft's origin per deployment.

## Decisions

- [ADR-009](../decisions/ADR-009-email-password-sign-in-for-mvp.md): email and password,
  sign-up closed, first user becomes owner. Creating accounts through an internal action
  is how ADR-009's "accounts come from the seed" is carried out, not a new decision.
