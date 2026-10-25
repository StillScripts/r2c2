# @workspace/backend

The Convex backend in `convex/`: schema, functions and the publish pipeline. The Loft
imports its API from `@workspace/backend/api`.

```bash
vp run --filter @workspace/backend dev   # push functions and watch for changes
vp run --filter @workspace/backend seed  # create the r2c2 site (safe to rerun)
vp run --filter @workspace/backend r2:check  # write, read and delete a test object in R2
vp test                                  # includes the convex-test suites
```

Every public function that touches site data is defined with `siteQuery` or
`siteMutation` from `convex/access.ts`, and loads any other document through `ownDoc`.

## Storage and routing secrets

Each deployment writes to its own R2 bucket and `ROUTES` KV namespace, because site IDs
differ between deployments (ADR-008). For dev:

```bash
wrangler r2 bucket create r2c2-sites-dev --location oc
wrangler kv namespace create ROUTES_DEV
npx convex env set R2_BUCKET r2c2-sites-dev
npx convex env set R2_TOKEN …            # R2 API token: Object Read & Write on the bucket
npx convex env set R2_ACCESS_KEY_ID …
npx convex env set R2_SECRET_ACCESS_KEY …
npx convex env set R2_ENDPOINT …
npx convex env set CLOUDFLARE_API_TOKEN …  # API token: Workers KV Storage Edit only
npx convex env set CLOUDFLARE_ACCOUNT_ID …
npx convex env set CLOUDFLARE_KV_NAMESPACE_ID …
```

Then run `r2:check`, and add a domain or rerun the seed to see `host:<hostname>` appear in
the namespace. Without the `CLOUDFLARE_*` variables, route syncs log a skip and do nothing.
