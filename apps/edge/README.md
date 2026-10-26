# Edge

The Cloudflare Worker that serves published sites: it looks up the request's hostname in
the `ROUTES` KV namespace, then serves the page from the `SITES` R2 bucket, and passes
`<site-form>` posts on to Convex.

## Running it

Sign in to Cloudflare once, then copy `.env.example` to `.env` and fill it in (SPEC §8):

```bash
vp exec wrangler login
vp run dev   # from apps/edge, on http://localhost:8787
```

`vp run dev` runs `wrangler dev --env dev`, whose bindings are remote: `SITES` is the
`r2c2-dev` bucket and `ROUTES` the `R2C2_ROUTES_DEV` namespace, the ones the Convex dev
deployment writes to. Reads and writes go to Cloudflare, not to local storage, so
anything you publish from the dev deployment is what the Worker serves. With the seed
site imported and published, open <http://r2c2.localhost:8787>, or:

```bash
curl -H "Host: r2c2.localhost" http://localhost:8787/
```

Redirects (`www.r2c2.localhost`, for one) point at `https://` on the default port, which
nothing listens on locally; check them with `curl -i`.

KV is eventually consistent, so a domain added or changed in the Loft can take up to about
60 seconds to resolve. A publish can take about as long to show, while the Worker's cached
copy of the page expires
([ADR-011](../../docs/decisions/ADR-011-workers-cache-without-purge.md)).

## Tests

`vp test` runs the Worker in workerd with the top-level bindings in `wrangler.jsonc`,
which are local and start empty, so tests never touch Cloudflare. Production bindings
come with `deploy-to-production`.
