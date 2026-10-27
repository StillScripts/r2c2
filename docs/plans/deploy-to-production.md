---
title: T23 Deploy to production
depth: detailed
created: 2026-10-27
decisions:
  - docs/decisions/ADR-016-deploy-production-from-github-actions.md
---

# T23 Deploy to production

Take milestone 1 live:

- a production Convex deployment in US East
- the edge Worker serving `lofty.page` and `*.lofty.page` from a Cloudflare zone
- the Loft on Workers at its `workers.dev` address
- GitHub Actions deploying all three once CI passes on `master`

Done when the marketing site is live on `lofty.page`, published from the production Loft.

## Context

- **Edge.** `apps/edge` already runs remotely in dev: `wrangler.jsonc` has local bindings at the top level for tests, and an `env.dev` block that points at bucket `r2c2-dev` and KV namespace `R2C2_ROUTES_DEV`. There is no production environment, no Worker routes and no secrets set for production.
- **Loft.** `apps/loft` (TanStack Start) has never been built for Workers: it has no `wrangler.jsonc`, and `vite.config.ts` has only the tailwind, tanstackStart and react plugins. ADR-010 chose Workers. `src/lib/auth-server.ts` reads `process.env.VITE_CONVEX_URL` and `process.env.CONVEX_SITE_URL` on the server, so both are needed at runtime as well as at build time.
- **Convex.** There is only the dev deployment `tangible-bear-808`, in US East. ADR-007 asked for the region to be chosen again before production, and the choice stays US East: visitors never reach Convex.
- **Domains in the backend.** `domains.ts` has only `add` and `remove`, both owner-facing `siteMutation`s that refuse hostnames in the sites domain. `scripts/import-site.ts` runs `convex run` without `--prod`, so it always writes to the dev deployment.
- **DNS.** `lofty.page` is registered at Vercel with Vercel's nameservers. ADR-015 (still `Proposed`) needs it to be a Cloudflare zone, with a proxied wildcard record so that every site address reaches the edge.
- **Storage.** Each Convex deployment needs its own R2 bucket and KV namespace (SPEC §8). The production bucket `r2c2-sites` is named in `wrangler.jsonc` but hasn't been created.
- **CI.** `.github/workflows/ci.yml` runs check, test and build on PRs and on pushes to `master`, and cancels a run that is still in progress when a newer one starts. It doesn't deploy anything.
- **Cache purge.** ADR-011 leaves Workers Cache purge parked until it has been re-tested on a custom domain. The spike kit in `apps/edge/spike/` is still there, but it is configured for `workers.dev` only.

## Approach

**Edge.** Add an `env.production` block to `apps/edge/wrangler.jsonc`:

- bucket `r2c2-sites` and the id of the `R2C2_ROUTES_PROD` KV namespace
- its own rate-limit namespace ids, so dev and production don't share counters
- routes `lofty.page/*` and `*.lofty.page/*` on zone `lofty.page`
- `workers_dev: false`

The top-level bindings stay local for tests. The bucket and the namespace are created before this PR merges, so the committed id is real by the time the first deploy runs. A `deploy` script runs `wrangler deploy --env production`.

**Loft.**

- **Build.** Add `@cloudflare/vite-plugin` to `vite.config.ts`, and add `apps/loft/wrangler.jsonc` with name `r2c2-loft`, `nodejs_compat` on and `workers_dev: true`.
- **No wrangler environments.** The Loft runs under Vite in dev, so it doesn't need one, and leaving them out keeps the Worker's name, and so its address, at `r2c2-loft.<account-subdomain>.workers.dev`.
- **Config values.** `VITE_CONVEX_URL` is inlined at build time for the browser, from a GitHub environment variable. The server reads `VITE_CONVEX_URL` and `CONVEX_SITE_URL` from `process.env` at runtime. Both are set once as Worker secrets with `wrangler secret put`, like the edge's `CONVEX_SITE_URL`. That keeps production URLs out of the repo, and `deploy` takes no flags.
- **Deploying.** `deploy` builds, then runs `wrangler deploy` on the config that the plugin writes into `dist/`.
- **Cookies.** `workers.dev` is on the Public Suffix List, so site pages on `*.lofty.page` can't set the Loft's cookies.

**Backend.**

- Add an internal mutation `domains:attach`, run from the CLI like `sites:create`. It attaches a hostname to a site as `primary` or `redirect`, and is allowed to take hostnames inside the sites domain. It still refuses one that's already taken and a site's own address, and it syncs routes like `add` does. Tests cover these cases.
- Give `import-site.ts` a `--prod` flag that it passes through to `convex run`.

**Configuration.**

- Production Convex env vars (SPEC §8):
  - `SITE_URL` = the Loft's `workers.dev` origin
  - `SITES_DOMAIN=lofty.page`
  - `EMAIL_FROM` on `mail.lofty.page`, with `RESEND_TEST_MODE=false`
  - a real `TURNSTILE_SITE_KEY`, on a widget that allows `lofty.page`
  - R2 and KV credentials scoped to the production bucket and namespace
  - a new `R2C2_SIGNING_SECRET` and `BETTER_AUTH_SECRET`
- Edge Worker secrets, set once with `wrangler secret put --env production`: `R2C2_SIGNING_SECRET`, `TURNSTILE_SECRET` and `CONVEX_SITE_URL`.
- Loft Worker secrets, set once with `wrangler secret put` after its first deploy: `VITE_CONVEX_URL` and `CONVEX_SITE_URL`.

**Deploys.** Add `.github/workflows/deploy.yml`.

- **Triggers.** It runs on `workflow_run` when CI completes successfully on `master`, which reuses CI's checks instead of repeating them. It also runs on `workflow_dispatch`, for the first deploy and for re-runs.
- **Jobs.** All jobs run in a `production` GitHub environment, one job per target, in this order:
  1. Convex: `npx convex deploy` with `CONVEX_DEPLOY_KEY`, so schema and functions land before anything calls them.
  2. Edge: `vp run --filter edge deploy`.
  3. Loft: `vp run --filter loft deploy`, with `VITE_CONVEX_URL` from an environment variable for the browser build.
- **Credentials.**
  - Convex uses `CONVEX_DEPLOY_KEY`.
  - Cloudflare uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token has the account permission Workers Scripts: Edit and the zone permission Workers Routes: Edit on `lofty.page`.
- **Missing setup.** A first step in each job maps its secrets into `env` and exits with a notice when they are empty. A job-level `if:` can't read `secrets` directly. This keeps runs before setup green instead of failing.
- **One deploy at a time.** `concurrency: deploy-production` makes deploys run one after another, without cancelling one that is already running.

**Runbook.** `docs/deploy.md` records the one-time setup and the smoke checks. That setup is outside the repo, and some steps can only be done by the owner (marked ✋):

- ✋ Add `lofty.page` as a Cloudflare zone, then change its nameservers at Vercel.
- Add proxied DNS records for the apex and `*`. Each one points at a placeholder address (`192.0.2.1`), because the Worker route handles the request.
- ✋ Verify `mail.lofty.page` in Resend and add its DNS records to the zone.
- ✋ Create the Convex production deployment in US East, a deploy key, and scoped Cloudflare API tokens: one for CI deploys, one for KV sync and one for R2.
- Set the env vars and secrets above, and the GitHub `production` environment secrets and variables. The Loft's origin comes from the first Loft deploy (it prints the `workers.dev` URL), so `SITE_URL` is set after that, and the Loft is deployed again.
- First deploy with `workflow_dispatch`, then go live:
  1. Create staff with `staff:create --prod`.
  2. Create the `r2c2` site with `sites:create --prod`.
  3. Import the marketing content with `site:import -- r2c2 --prod`.
  4. Run `domains:attach --prod` for `lofty.page` (primary) and `www.lofty.page` (redirect).
  5. Publish from the production Loft and take the site live.

**Cache re-test.** Add a `spike:deploy:zone` script that deploys the spike with `--route "spike.lofty.page/*"`. Wrangler infers the zone, and this more specific route takes precedence over the wildcard. Then run `spike:check` against `https://spike.lofty.page`, and delete the spike. Record the result in the task.

- If purge works: move `add-signed-purge-route` back to `someday/` with a note, and mark ADR-011 for replacement.
- If it doesn't: add the zone result to ADR-011's context.

## Alternatives considered

- **Manual CLI deploys first, CI later:** simpler, but the owner chose CI now, so releases are repeatable from the start.
- **Deploy workflow repeats CI's checks:** slower, and two copies can drift apart. `workflow_run` deploys exactly the commit that CI passed.
- **Loft on `app.lofty.page`:** rejected by ADR-015 until `lofty.page` is on the Public Suffix List.
- **Convex in Sydney:** rejected again for the reasons in ADR-007. Nothing at the edge waits on Convex.
- **A `production` wrangler environment for the Loft:** it would rename the Worker to `r2c2-loft-production`, and the Loft has no dev Worker to tell apart from it.
- **Cloudflare's GitHub integration (Workers Builds) instead of Actions:** one more place to configure, and it can't run Convex before the Workers.

## Scope

- In:
  - edge production env and routes
  - the Loft's Workers build and config
  - `domains:attach` and `site:import --prod`
  - the deploy workflow and package `deploy` scripts
  - `docs/deploy.md` runbook, plus SPEC §8 and `.env.example` updates
  - the ADR for deploying from Actions, and accepting ADR-015
  - one-time infra setup, the first deploy, go-live and the smoke checks
  - the cache re-test
- Out:
  - preview environments per PR (`add-pr-preview-environments`)
  - a custom domain for the Loft
  - client custom domains (SPEC §11)
  - the signed purge route itself (T08)
  - adding `lofty.page` to the PSL

## Action items

### Before merge (this PR)

- [x] Get the Loft building for Workers: add the Cloudflare Vite plugin and `apps/loft/wrangler.jsonc` (`r2c2-loft`, `nodejs_compat`). `vp run build` and `vp preview` must work against the dev deployment: sign in, open a site, publish. Add a `deploy` script.
- [x] Create the `r2c2-sites` bucket (`--location oc`) and the `R2C2_ROUTES_PROD` KV namespace with wrangler, after the owner confirms
- [x] Add `env.production` to `apps/edge/wrangler.jsonc` (bucket, KV id, separate rate-limit ids, the two routes, `workers_dev: false`), and a `deploy` script
- [x] Add the internal `domains:attach` mutation with tests, and a `--prod` flag on `import-site.ts`
- [x] Add `spike:deploy:zone` for the cache re-test on `spike.lofty.page`
- [x] Add `.github/workflows/deploy.yml` (`workflow_run` after CI on `master`, plus `workflow_dispatch`; Convex → edge → Loft; a secrets guard on each job; `concurrency` with no cancelling)
- [x] Write `docs/deploy.md` with the one-time setup, secrets and token scopes, first deploy, go-live and smoke checks
- [x] Update SPEC §8 (production values and deploy secrets) and the `.env.example` files
- [x] Record the ADR for deploying production from GitHub Actions with `document-decisions`. Mark ADR-015 `Accepted`, and add a note to ADR-007 that production is also in US East.
- [ ] Run `vp check`, `vp test` and `vp run build`

### After merge (owner and agent)

- [ ] ✋ Add the `lofty.page` zone and switch its nameservers at Vercel, then add the proxied apex and `*` records
- [ ] ✋ Create the Convex production deployment (US East), its deploy key, and the scoped Cloudflare tokens. Verify `mail.lofty.page` in Resend.
- [ ] Set Convex production env vars, edge Worker secrets, and GitHub `production` secrets and variables. Run the first deploy with `workflow_dispatch`, then set `SITE_URL` from the Loft's address and deploy again.
- [ ] Go live: create staff and the site, import the content, attach `lofty.page` and `www.lofty.page`, publish from the Loft and set the site live
- [ ] Run the cache re-test on `spike.lofty.page`, record the result, and follow up on T08 and ADR-011
- [ ] Run the smoke checks

## Testing

- `vp check`, `vp test` and `vp run build` pass. The Loft's Workers build is part of `vp run build`, so CI catches a Workers-incompatible import.
- New `domains.test.ts` cases for `attach`:
  - it accepts a hostname in the sites domain
  - it refuses a hostname that's already taken
  - it refuses the site's own address
  - it syncs routes
- `vp preview` in `apps/loft` against the dev deployment: sign in, open a site, publish.
- Smoke checks after go-live:
  - a second request to `https://lofty.page/` returns `cf-cache-status: HIT`
  - the security headers from SPEC §5 are present
  - `www.lofty.page` sends a 301 to `lofty.page`
  - an unknown `*.lofty.page` host gets a 404
  - a contact form enquiry arrives by email
  - Loft sign-in works on `workers.dev`

## Risks

- **DNS cutover takes `lofty.page` off Vercel.** Nothing is served there yet, so the impact is low. Still, read the existing records at Vercel before switching and copy any that matter.
- **The Loft's Workers build may hit Node-only code** in TanStack Start or Better Auth. Use `nodejs_compat` first. If it still fails, find the import and keep it off the server bundle. This is the first action item because it's the most likely to change the design.
- **Pushes to `master` run before setup is done.** Each job's secrets guard skips with a notice instead of failing, and the edge's KV id is already real.
- **A wrong `SITE_URL` breaks staff sign-in.** The smoke checks cover sign-in, and changing `SITE_URL` is quick to fix.
- **Leaked production secrets.** Keep them in the GitHub environment, the Convex env and the Worker secrets only. Use tokens scoped as narrowly as possible, and never commit them.

## Decisions

- [ADR-007](../decisions/ADR-007-run-convex-in-us-east.md): production also runs in US East. The ADR gets a note that the choice was confirmed.
- [ADR-010](../decisions/ADR-010-host-the-loft-on-cloudflare-workers.md): the Loft on Workers, at `workers.dev` for now
- [ADR-015](../decisions/ADR-015-give-each-site-a-lofty-page-address.md): the zone, the wildcard route and keeping the Loft off `lofty.page`. It becomes `Accepted`.
- [ADR-016](../decisions/ADR-016-deploy-production-from-github-actions.md): deploy production from GitHub Actions after CI passes on `master` (Convex, then edge, then Loft)

## Open questions

- Does `ctx.cache.purge` work on the zone? Answered by the cache re-test.
- Should Loft users ever reach a branded host (say `app.<other-domain>`)? This is deferred, and changing it means moving `SITE_URL` and the Loft's route.
