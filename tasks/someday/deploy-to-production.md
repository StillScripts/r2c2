---
title: T23 Deploy to production
created: 2026-10-24
---

Put the marketing site live, published from the production Loft.

- Cloudflare: bucket, KV, Worker, routes for the marketing domain; Convex production deployment; Loft hosting
- Smoke checks: `cf-cache-status: HIT` on a second request, security headers present, an enquiry arrives by email

Done when the marketing site is live, published from the production Loft.

Needs: `pick-marketing-site-domain`, `choose-loft-hosting-platform`

Spec: [SPEC §8](../../SPEC.md)
