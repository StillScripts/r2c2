---
title: Add a script that syncs the Workers' production secrets
created: 2026-10-27
completed: 2026-10-27
---

Set the edge's and the Loft's production secrets in one command, piping each value from where it already lives, so nobody copies a secret by hand.

- `vp run --filter @workspace/backend secrets:sync`: `R2C2_SIGNING_SECRET` from Convex, `TURNSTILE_SECRET` from the Turnstile widget, `CONVEX_SITE_URL` for the edge; `VITE_CONVEX_URL` and `CONVEX_SITE_URL` for the Loft
- Bring `docs/deploy.md` up to date with what the first production setup ran into

Done when the script has set all six secrets on production and the runbook uses it.

Related: [ADR-016](../../docs/decisions/ADR-016-deploy-production-from-github-actions.md), `deploy-to-production`
