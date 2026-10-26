---
title: T23 Deploy to production
created: 2026-10-24
---

Take milestone 1 to production on Cloudflare and Convex.

- DNS: move `lofty.page` from Vercel to a Cloudflare zone (change its nameservers at Vercel), with proxied apex and `*` records and Worker routes for `lofty.page/*` and `*.lofty.page/*`; set `SITES_DOMAIN=lofty.page` on the production Convex deployment ([ADR-015](../../docs/decisions/ADR-015-give-each-site-a-lofty-page-address.md))
- Attach `lofty.page` (primary) and `www.lofty.page` (redirect) to the marketing site from the CLI, since `domains:add` refuses hostnames in the sites domain; keep the Loft off `lofty.page` or add it to the Public Suffix List first
- Cloudflare: bucket, KV, Worker; Convex production deployment (revisit its region first); the Loft on Workers (ADR-010)
- Re-run the Workers Cache spike (`apps/edge/spike/`) on a custom domain on the zone; if `ctx.cache.purge` works there, revive T08 (`add-signed-purge-route`) per [ADR-011](../../docs/decisions/ADR-011-workers-cache-without-purge.md)
- Smoke checks: `cf-cache-status: HIT` on a second request, security headers present, an enquiry arrives by email

Done when the marketing site is live, published from the production Loft.

Related: [SPEC §8](../../SPEC.md#8-environments-and-secrets), [ADR-007](../../docs/decisions/ADR-007-run-convex-in-us-east.md), `pick-marketing-site-domain` (`lofty.page`), [ADR-010](../../docs/decisions/ADR-010-host-the-loft-on-cloudflare-workers.md)
