# @workspace/backend

The Convex backend in `convex/`: schema, functions and the publish pipeline. The Loft
imports its API from `@workspace/backend/api`.

```bash
vp run --filter @workspace/backend dev   # push functions and watch for changes
vp run --filter @workspace/backend seed  # create the r2c2 site (safe to rerun)
vp run --filter @workspace/backend r2:check  # write, read and delete a test object in R2
vp test                                  # includes the convex-test suites
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
at runtime.

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
