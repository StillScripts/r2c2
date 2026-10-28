# @workspace/backend

The Convex backend in `convex/`: schema, functions and the publish pipeline. The Loft
imports its API from `@workspace/backend/api`.

```bash
vp run --filter @workspace/backend dev   # push functions and watch for changes
vp run --filter @workspace/backend seed  # create the r2c2 site at r2c2.localhost (safe to rerun)
vp run --filter @workspace/backend site:import  # load sites/r2c2 into it as drafts
vp run --filter @workspace/backend r2:check  # write, read and delete a test object in R2
vp run --filter @workspace/backend secrets:sync  # set the production Workers' secrets (docs/deploy.md)
vp test                                  # includes the convex-test suites
```

## Sites and their addresses

Every site gets `<slug>.<SITES_DOMAIN>` as its primary domain when it's created
([ADR-015](../../docs/decisions/ADR-015-give-each-site-a-lofty-page-address.md)).
`SITES_DOMAIN` is `lofty.page` in production; dev leaves it unset and gets `localhost`, so
sites open at `http://<slug>.localhost:8787` on the local edge. Until the Loft can create
sites, create one from the CLI, then add its owner with `staff:create`:

```bash
npx convex env set SITES_DOMAIN lofty.page   # production only
vp exec convex run sites:create '{"name": "Acme Dental", "slug": "acme-dental"}'
```

A slug is one DNS label and can't be a reserved name like `www` or `app`
(`RESERVED_SLUGS` in `@workspace/core`). The address stays with the site: owners can't
remove it or add other hostnames under the sites domain. It's a domain of kind `address`: it
serves the site until a custom primary is active, then redirects to it
(`primaryDomain` in `@workspace/core`).

The marketing site is served at `lofty.page` itself, inside the sites domain. Only the CLI
can attach hostnames there, with `domains:attach`. It runs the same checks as `domains:add`
apart from the sites-domain rule:

```bash
vp exec convex run --prod domains:attach '{"slug": "r2c2", "hostname": "lofty.page", "kind": "primary"}'
vp exec convex run --prod domains:attach '{"slug": "r2c2", "hostname": "www.lofty.page", "kind": "redirect"}'
vp run --filter @workspace/backend site:import -- r2c2 --prod  # import into production
vp run --filter @workspace/backend site:import -- r2c2 --into r2c2-site --prod  # into a site with another slug
```

## Staff sign-in

Better Auth runs inside Convex (`convex/auth.ts`), with email and password and public
sign-up closed (ADR-009). Each deployment needs two variables. `SITE_URL` is the Loft's
origin, which Better Auth trusts:

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL http://localhost:3000
```

Create staff accounts from the CLI. The first member of a site becomes its owner, and later
ones are editors unless you pass `"role": "owner"`. `site` is a slug and defaults to the
seed site, `r2c2`. For an email that already has an account, leave out `name` and
`password` to add it to another site.

```bash
vp exec convex run staff:create '{"email": "you@example.com", "name": "You", "password": "…"}'
```

Every public function that touches site data is defined with `siteQuery` or
`siteMutation` from `convex/access.ts`, and loads any other document through `ownDoc`.

## Pages and draft history

`convex/pages.ts` lists, creates and saves pages; saving only ever writes `draftHtml`
(and `title`, from the draft's `<title>`). Draft snapshots live in the
`@convex-dev/table-history` component, installed as `pageHistory`. It's in beta, so only
`recordDraft()` and `draftHistory()` in `convex/history.ts` call it. A save records a
snapshot when the last one is more than five minutes old; publish, restore and AI edits
always record (SPEC §6).

`preview:preview` is a Node action that compiles a draft's Tailwind with the site's theme
and runs the house rules, exactly as publish will. `convex.json` keeps `tailwindcss`
external (installed from this package's dependencies) so it can read its own stylesheet
at runtime. Convex only installs an external package that a file in this package
imports, not one imported from `@workspace/html`, so `preview.ts`, `publish.ts` and `theme.ts`
import `tailwindcss` themselves.

## Publish and rollback

`publish:publish` builds the draft with `buildRelease` from `@workspace/html`, writes its
CSS, version and live copy to R2, then marks it live. `publish:rollback` copies an older
version back to the live key. Both return or throw readable errors, and the edge picks
the change up within a minute (ADR-011). Until the Loft has buttons for them (T16), run
them as a member:

```bash
vp exec convex run publish:publish '{"siteId": "…", "pageId": "…"}' --identity '{"subject": "<userId>"}'
vp exec convex run publish:rollback '{"siteId": "…", "pageId": "…", "versionId": "…"}' --identity '{"subject": "<userId>"}'
```

Pages with a `<site-form>` need `TURNSTILE_SITE_KEY` on the deployment
(`1x00000000000000000000AA` in dev). They also load the shared elements script, which
publish uploads from `elements.gen.ts` (ADR-012). After changing `packages/elements`,
regenerate and commit it:

```bash
vp run --filter @workspace/backend elements
```

## Enquiry emails

Each stored enquiry schedules `notifications:enquiryEmail`, which emails the site's
owners through `@convex-dev/resend` (one email per enquiry, with Reply-To set to the
form's email field). Set the sender and key on the deployment:

```bash
npx convex env set RESEND_API_KEY …
npx convex env set EMAIL_FROM "R2C2 <onboarding@resend.dev>"
```

Test mode is on unless `RESEND_TEST_MODE` is `false`: every notification goes to Resend's
test inbox, `delivered@resend.dev`, and names the owners it was meant for. Without
`EMAIL_FROM` the notification logs a warning and sends nothing.

## Storage and routing secrets

Each deployment writes to its own R2 bucket and `ROUTES` KV namespace, because site IDs
differ between deployments (ADR-008). For dev:

```bash
wrangler r2 bucket create r2c2-dev --location oc
wrangler kv namespace create R2C2_ROUTES_DEV
npx convex env set R2_BUCKET r2c2-dev
# From an R2 API token with Object Read & Write on the bucket (its "token value" isn't used):
npx convex env set R2_ACCESS_KEY_ID …
npx convex env set R2_SECRET_ACCESS_KEY …
npx convex env set R2_ENDPOINT …         # https://<account-id>.r2.cloudflarestorage.com
npx convex env set CLOUDFLARE_ACCOUNT_ID …
npx convex env set CLOUDFLARE_KV_NAMESPACE_ID …  # the namespace's 32-character ID, not its name
npx convex env set CLOUDFLARE_API_TOKEN …  # API token: Workers KV Storage Edit (Write) only
```

Then run `r2:check`, and add a domain or rerun the seed to see `host:<hostname>` appear in
the namespace. Without the `CLOUDFLARE_*` variables, route syncs log a skip and do nothing. A failed sync logs Cloudflare's error on
each attempt and retries up to five times.
