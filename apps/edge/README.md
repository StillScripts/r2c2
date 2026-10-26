# Edge

The Cloudflare Worker that serves published sites: it looks up the request's hostname in
the `ROUTES` KV namespace, then serves the page from the `SITES` R2 bucket, and passes
`<site-form>` posts on to Convex.

## Running it

Sign in to Cloudflare once, then copy `.env.example` to `.env` and fill it in
([SPEC §8](../../SPEC.md#8-environments-and-secrets)):

```bash
vp exec wrangler login
vp run --filter edge dev   # on http://localhost:8787
```

This runs `wrangler dev --env dev` with remote bindings: `SITES` is the `r2c2-dev`
bucket and `ROUTES` is `R2C2_ROUTES_DEV`, which the Convex dev deployment writes to (see
[Storage and routing secrets](../../packages/backend/README.md#storage-and-routing-secrets)).
With the seed site imported and published, open <http://r2c2.localhost:8787>, or:

```bash
curl -H "Host: r2c2.localhost" http://localhost:8787/
```

Redirects (`www.r2c2.localhost`, for one) point at `https://` on the default port, which
nothing listens on locally; check them with `curl -i`.

KV is eventually consistent and the Worker caches pages
([ADR-011](../../docs/decisions/ADR-011-workers-cache-without-purge.md)), so a domain
change or a publish can take about 60 seconds to show.

## Tests

`vp test` runs the Worker in workerd with the top-level bindings in `wrangler.jsonc`,
which are local and empty, so tests never touch Cloudflare.
