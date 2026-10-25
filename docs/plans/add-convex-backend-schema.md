---
title: T09 Add the Convex backend and schema
depth: detailed
created: 2026-10-25
decisions:
  - docs/decisions/ADR-008-use-convex-ids-as-site-ids.md
---

# T09 Add the Convex backend and schema

Give `packages/backend` the milestone 1 data model (SPEC §6) and the access layer every later
Convex function goes through: `siteQuery` and `siteMutation` load the site and refuse
callers who aren't members, and an audit helper writes `auditLog`. A seed mutation creates
the `r2c2` site so the Loft and edge have something to work against. convex-test proves
that one site can never read or write another site's data.

## Context

- `packages/backend` is connected to the dev deployment `tangible-bear-808` (ADR-007), with
  `convex` 1.48.0 installed and an empty `convex/` holding only `_generated/`.
- Sign-in comes in T10 (Better Auth through `@convex-dev/better-auth`). It's blocked on
  `choose-staff-sign-in-method`, so T09 builds against `ctx.auth.getUserIdentity()` alone,
  and tests supply a fake identity with `t.withIdentity`. With no `auth.config.ts` yet, the
  deployed functions see every caller as signed out, which is the safe default.
- ADR-006 sets the error style: Convex functions throw `ConvexError` for failures a user
  should see.
- ADR-005 says element IDs are assigned in the mutation that saves a draft. Page editing is
  T15 (`add-pages-and-html-editor`), so that wiring stays there.
- SPEC §7: public sites call no public Convex functions, and Loft functions check
  membership on every call.

## Approach

**Layout.** Functions live in `packages/backend/convex/`. The package's `exports` change
from `src/index.ts` to the generated code: `./api` points at `convex/_generated/api.js`
and `./dataModel` at `convex/_generated/dataModel.d.ts`, so the Loft imports
`@workspace/backend/api`. `src/` goes. The package gets a `tsconfig.json` covering
`convex/` (with `lib` for the Convex runtime), and a `vite.config.ts` with the
`edge-runtime` test environment and `convex-test` inlined, as convex-test requires.

**Schema** (`convex/schema.ts`), following SPEC §6 field by field:

- `sites`: `name`, `slug`, `status` (`live` | `coming-soon`, matching the KV contract in
  `packages/core`), `theme` (the site's CSS string of `@theme` tokens and `@utility`
  classes, the input `packages/html` already compiles). Index `by_slug`.
- `domains`: `siteId`, `hostname`, `kind` (`primary` | `redirect`), `status` (`pending` |
  `active`; KV sync in T12 writes only `active` ones). Indexes `by_hostname`, `by_site`.
- `pages`: `siteId`, `path`, `title`, `draftHtml`, optional `liveVersionId`. Index
  `by_site_path`.
- `pageVersions`: `siteId`, `pageId`, `hash`, `cssHash`, `forms` (the `FormDefinition[]`
  shape from `packages/html`), `publishedBy`, `publishedAt`. Index `by_page`.
- `forms`: `siteId`, `name`, `fields` (`name`, `type`, `required`, optional `maxLength`).
  Index `by_site_name`. This is the registry that enquiry intake (T19) checks against;
  publish (T13) updates it from the version's `forms`, which stay as the record of what
  each version declared.
- `enquiries`: `siteId`, `form`, `data` (record of strings), `source` (`page`, optional
  `referrer`, `utm` record, as in `packages/core`), `status` (`new` | `handled`),
  `createdAt`. Index `by_site_created`. Dedupe fields come with T19.
- `memberships`: `userId`, `siteId`, `role` (`owner` | `editor`). Indexes `by_user_site`
  (`userId`, `siteId`, which also serves SPEC's `by_user` lookups by prefix) and `by_site`.
- `auditLog`: `siteId`, `actor` (user ID or `"system"`), `action` (for example
  `site.rename`), `target` (the affected document's ID as a string), `at`. Index
  `by_site_at`.

Shared validators (`role`, `formField`, `enquirySource`, the status unions) live in one
`convex/validators.ts` so the schema and function args use the same definitions.

**The site ID.** The public `siteId` used in KV entries, R2 keys, cache tags and the
`x-r2c2-site` header is the Convex document ID of the `sites` row. It never changes, unlike
a slug, and Convex can check it with `v.id("sites")` without a lookup. SPEC §5's
`s_r2c2` was only an example. This is a cross-system contract, so it gets an ADR.

**User IDs.** `memberships.userId` stores `identity.subject`. With
`@convex-dev/better-auth` that's the Better Auth user ID, so T10 needs no migration.

**Access helpers** (`convex/access.ts`, built with convex-helpers' `customQuery` and
`customMutation`):

- `siteQuery` and `siteMutation` take a `siteId: v.id("sites")` argument, then:
  1. read the identity, and throw `ConvexError({ code: "unauthenticated" })` if there is none;
  2. load the site and the membership for `(userId, siteId)`, and throw `not_found` if
     either is missing. A site you aren't a member of looks the same as one that doesn't
     exist, so site IDs can't be probed;
  3. throw `forbidden` only when a member lacks the role an owner-only helper needs.
- The handler's `ctx` gains `site`, `membership` and `userId`, and its args keep `siteId`.
- An optional `role: "owner"` setting makes a helper refuse editors, for owner-only
  actions such as managing domains later.
- `ownDoc(ctx, table, id)` loads a site-owned document (page, form, version, enquiry,
  domain) and throws `not_found` unless its `siteId` is `ctx.site._id`. Every function
  that takes another document's ID goes through it. Checking `siteId` alone isn't enough:
  a member of A could pass A's `siteId` with B's `pageId`.
- `audit(ctx, { action, target })` inserts into `auditLog` with the site and actor from
  `ctx`. Internal callers (HTTP actions, the scheduler) get their own helper, with an actor
  such as `"system"`, when T13 and T19 need one.

**Seed** (`convex/seed.ts`): an internal mutation, run with `vp run seed` (a backend
script calling `convex run seed:default`). It's idempotent by slug. It creates the `r2c2`
site (status `coming-soon`, a starter theme), an active primary domain `r2c2.localhost`
for `wrangler dev`, a redirect domain `www.r2c2.localhost` so both kinds exist, and an
empty home page at `/`. No memberships: T10 makes the first
user the owner. The marketing domain is added once `pick-marketing-site-domain` is decided.

**Exercising the helpers.** T09 adds two small real functions, so the tests check
behaviour rather than helper internals: `sites.get` (a `siteQuery` returning the site),
`sites.rename` (an owner-only `siteMutation` that renames the site and writes an audit
entry) and `pages.get` (a `siteQuery` taking a `pageId`, through `ownDoc`). The Loft
needs all three anyway.

## Alternatives considered

- **The slug as the public site ID:** it reads nicely in R2 and logs, but renaming a site
  would mean rewriting every R2 key and KV entry.
- **A separate `publicId` field:** this adds a lookup and an index on every edge request
  for no gain over the document ID.
- **A plain `requireMember(ctx, siteId)` call in each function:** this is easy to forget.
  The custom-function wrappers make the check part of how a function is defined, which is
  what SPEC §6 asks for.
- **Storing `tokenIdentifier` as the user ID:** this is unique across identity providers,
  but there is only one provider (Better Auth), and `subject` matches the user ID Better
  Auth uses everywhere else.

## Scope

- In: the schema, validators, access helpers (including `ownDoc`), audit helpers, seed,
  `sites.get`, `sites.rename` and `pages.get`, convex-test setup, backend package wiring (exports, tsconfig, test config,
  catalog entries for `convex-helpers`, `convex-test` and `@edge-runtime/vm`), pushing the
  schema to the dev deployment, and an ADR for the site ID.
- Out: auth config and sign-in (T10); page create and edit, draft saves, element IDs and
  `pageHistory` (T15); R2 and KV sync (T12); enquiry intake, dedupe and rate limiting (T19);
  email.

## Action items

- [x] Add `convex-helpers` 0.1.129, `convex-test` 0.0.65 and `@edge-runtime/vm` 5.0.0 to the catalog and `packages/backend`.
- [x] Rewire `packages/backend`: point `exports` at the generated API, remove `src/`, cover `convex/` in its tsconfig, add `vite.config.ts` for convex-test and a `seed` script.
- [x] Write `convex/validators.ts` and `convex/schema.ts` per the approach.
- [x] Write `convex/access.ts` (`siteQuery`, `siteMutation`, owner-only option, `ownDoc`, `audit`).
- [x] Write `convex/sites.ts` (`get`, `rename`), `convex/pages.ts` (`get`) and `convex/seed.ts`.
- [x] Add tests (below), then run `vp check` and `vp test`.
- [x] Push to the dev deployment with `convex dev --once`, run the seed twice, and confirm one site, two domains and one page exist.
- [x] Record the site ID decision as ADR-008. Update SPEC §5's example and SPEC §6 (the `by_user_site` index, domain `status` values, `ownDoc`).
- [x] Update `packages/backend/README.md` with how to push, seed and test.

## Testing

convex-test, in `convex/*.test.ts` (the Convex CLI doesn't deploy test files):

- Signed out: `sites.get` and `sites.rename` throw `unauthenticated`.
- A member of site A can read A. Reading B and reading a deleted site are both `not_found`.
- An editor gets `forbidden` from `sites.rename`, and an owner can rename. A successful
  rename writes one audit entry with the right site, actor and action, and renaming B as
  a member of A changes nothing in B.
- `pages.get` with A's `siteId` and B's `pageId` is `not_found`.
- The seed is idempotent: running it twice leaves one site, two domains and one page.
- The schema rejects invalid values (an unknown role, an unknown domain kind).

## Risks

- **TypeScript 7 and the Convex CLI.** `convex dev` type checks with the installed `typescript`. If it can't drive TypeScript 7, push with `--typecheck=disable` and rely on `vp check`, which already type checks the package.
- **convex-test under Vite+.** It needs the `edge-runtime` environment and `import.meta.glob`. The root `test.projects` picks up `packages/backend/vite.config.ts`, as it does for `apps/edge`'s Workers plugin, so the settings live there.
- **Helper API churn.** convex-helpers is 0.x. It stays wrapped inside `access.ts`, so only one file depends on its API.

## Decisions

- [ADR-008](../decisions/ADR-008-use-convex-ids-as-site-ids.md): the public site ID is the
  Convex `sites` document ID.

## Open questions

- The seed uses `r2c2.localhost` until `pick-marketing-site-domain` is decided. Is that the
  right local hostname for `wrangler dev`?
- The starter theme in the seed is a few tokens (colour, font, radius) for now. A real
  theme comes with the marketing site (T22).
