# Deploying to production

Production has three parts, all deployed by `.github/workflows/deploy.yml` once CI passes on `master` (or by hand from the Actions tab with **Run workflow**):

| Part   | Where                                                                                                                         | Deploy command                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Convex | production deployment of project `r2c2`, US East ([ADR-007](decisions/ADR-007-run-convex-in-us-east.md))                      | `vp exec convex deploy` in `packages/backend` |
| Edge   | Worker `r2c2-edge-production`, routes `lofty.page/*` and `*.lofty.page/*`                                                     | `vp run --filter edge deploy`                 |
| Loft   | Worker `r2c2-loft` at `r2c2-loft.<account>.workers.dev` ([ADR-010](decisions/ADR-010-host-the-loft-on-cloudflare-workers.md)) | `vp run --filter loft deploy`                 |

Convex goes first so the schema and functions are live before the Workers call them. A job whose secrets aren't set yet skips with a notice instead of failing, so pushes before setup stay green.

The Loft stays off `lofty.page`: site pages are served from its subdomains and could set cookies for it ([ADR-015](decisions/ADR-015-give-each-site-a-lofty-page-address.md)). `workers.dev` is on the Public Suffix List, so it's safe there.

## One-time setup

Steps marked ✋ need the account owner. Run the `wrangler` commands from `apps/edge` (or `apps/loft` where noted) after `vp exec wrangler login`.

### 1. DNS ✋

1. In Cloudflare, add `lofty.page` as a zone (Free plan is enough).
2. At Vercel, note any existing DNS records worth keeping, then change the domain's nameservers to the two Cloudflare gives you. Wait for the zone to show **Active**.
3. Add two proxied records that only exist so requests reach the Worker routes:
   - `A` `lofty.page` → `192.0.2.1`, proxied
   - `A` `*` → `192.0.2.1`, proxied
4. SSL/TLS mode: **Full (strict)**. Universal SSL covers `lofty.page` and `*.lofty.page`.

### 2. Storage

Created already (T23). For a fork, or to recreate them:

```bash
vp exec wrangler r2 bucket create r2c2-sites --location oc
vp exec wrangler kv namespace create R2C2_ROUTES_PROD   # put its id in env.production in wrangler.jsonc
```

### 3. Email ✋

In Resend, add the domain `mail.lofty.page` and add the DNS records it lists to the Cloudflare zone (unproxied). Wait for it to verify.

### 4. Convex ✋

1. In the Convex dashboard for project `r2c2`, create the production deployment in **US East**.
2. Under its settings, generate a **production deploy key**.
3. Set its environment (from `packages/backend`, `--prod` targets production):

```bash
npx convex env set --prod SITES_DOMAIN lofty.page
npx convex env set --prod SITE_URL https://r2c2-loft.<account>.workers.dev   # after the first Loft deploy prints it
npx convex env set --prod BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set --prod R2C2_SIGNING_SECRET "<new secret, also given to the edge>"
npx convex env set --prod TURNSTILE_SITE_KEY <site key of a widget allowing lofty.page>
npx convex env set --prod EMAIL_FROM "R2C2 <enquiries@mail.lofty.page>"
npx convex env set --prod RESEND_TEST_MODE false
npx convex env set --prod RESEND_API_KEY <key>
# R2: an R2 API token with Object Read & Write on r2c2-sites only
npx convex env set --prod R2_ACCESS_KEY_ID …
npx convex env set --prod R2_SECRET_ACCESS_KEY …
npx convex env set --prod R2_ENDPOINT https://<account-id>.r2.cloudflarestorage.com
npx convex env set --prod R2_BUCKET r2c2-sites
# KV sync: an API token with only Workers KV Storage: Edit
npx convex env set --prod CLOUDFLARE_API_TOKEN …
npx convex env set --prod CLOUDFLARE_ACCOUNT_ID <account-id>
npx convex env set --prod CLOUDFLARE_KV_NAMESPACE_ID e8b454708a764955b7cdc54d98f5a541
```

### 5. Worker secrets

```bash
# apps/edge
vp exec wrangler secret put R2C2_SIGNING_SECRET --env production   # same value as Convex
vp exec wrangler secret put TURNSTILE_SECRET --env production      # the widget's secret key
vp exec wrangler secret put CONVEX_SITE_URL --env production       # https://<prod>.convex.site

# apps/loft (the server reads both at runtime)
vp exec wrangler secret put VITE_CONVEX_URL                        # https://<prod>.convex.cloud
vp exec wrangler secret put CONVEX_SITE_URL                        # https://<prod>.convex.site
```

A Worker has to exist before it can hold secrets, so set the Loft's after its first deploy.

### 6. GitHub ✋

Create a Cloudflare API token for deploys with:

- Account › **Workers Scripts: Edit**
- Zone `lofty.page` › **Workers Routes: Edit**

Do this only once the zone is **Active**, because the edge deploy fails while its routes point at a zone that doesn't exist yet. Then, in the repo's **Settings › Environments**, create `production` with:

| Kind     | Name                    | Value                         |
| -------- | ----------------------- | ----------------------------- |
| Secret   | `CONVEX_DEPLOY_KEY`     | the production deploy key     |
| Secret   | `CLOUDFLARE_API_TOKEN`  | the deploy token above        |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | the account id                |
| Variable | `VITE_CONVEX_URL`       | `https://<prod>.convex.cloud` |

## First deploy

1. Run **Deploy** from the Actions tab. Its Loft job prints the `workers.dev` URL.
2. Set `SITE_URL` on Convex to that origin, set the Loft's Worker secrets (step 5), and run **Deploy** again.

## Going live

From `packages/backend`:

```bash
vp exec convex run --prod sites:create '{"name": "R2C2", "slug": "r2c2"}'
vp exec convex run --prod staff:create '{"email": "…", "name": "…", "password": "…", "site": "r2c2"}'
vp run site:import -- r2c2 --prod
vp exec convex run --prod domains:attach '{"slug": "r2c2", "hostname": "lofty.page", "kind": "primary"}'
vp exec convex run --prod domains:attach '{"slug": "r2c2", "hostname": "www.lofty.page", "kind": "redirect"}'
```

Then sign in to the Loft, publish each page and take the site live. `r2c2.lofty.page` and `www.lofty.page` now redirect to `lofty.page`.

## Smoke checks

```bash
curl -sI https://lofty.page/ | grep -iE 'cf-cache-status|content-security-policy|strict-transport-security|x-content-type-options'
curl -sI https://lofty.page/ | grep -i cf-cache-status     # HIT on the second request
curl -sI https://www.lofty.page/about | grep -iE '^(HTTP|location)'   # 301 to https://lofty.page/about
curl -sI https://nobody.lofty.page/ | head -1               # 404
```

- Send the contact form on `lofty.page` and check the enquiry email arrives and shows in the Loft's inbox.
- Sign out of the Loft and back in.

## Cache purge re-test

[ADR-011](decisions/ADR-011-workers-cache-without-purge.md) parked purge after it failed on `workers.dev`. To re-test on the zone (from `apps/edge`):

```bash
vp run spike:deploy:zone                 # route spike.lofty.page/*, more specific than *.lofty.page/*
vp run spike:check -- https://spike.lofty.page
vp run spike:delete
```

If purge works, bring back `add-signed-purge-route` (T08) and replace ADR-011.
