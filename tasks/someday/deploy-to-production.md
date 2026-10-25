---
title: T23 Deploy to production
created: 2026-10-24
---

Take milestone 1 to production on Cloudflare and Convex.

- Cloudflare: bucket, KV, Worker, routes for the marketing domain; Convex production deployment (revisit its region first); the Loft on Workers (ADR-010)
- Smoke checks: `cf-cache-status: HIT` on a second request, security headers present, an enquiry arrives by email

Done when the marketing site is live, published from the production Loft.

Related: [SPEC §8](../../SPEC.md#8-environments-and-secrets), [ADR-007](../../docs/decisions/ADR-007-run-convex-in-us-east.md), `pick-marketing-site-domain`, [ADR-010](../../docs/decisions/ADR-010-host-the-loft-on-cloudflare-workers.md)
