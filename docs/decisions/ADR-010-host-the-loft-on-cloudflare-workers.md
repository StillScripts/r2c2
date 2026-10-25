# ADR-010: Host the Loft on Cloudflare Workers

## Status

Accepted

## Date

2026-10-25

## Context

The Loft (`apps/loft`, TanStack Start) needs a production host for T23. The edge Worker, R2 and KV already run on Cloudflare (SPEC §2), and Convex hosts the backend.

## Decision

Deploy the Loft to Cloudflare Workers with TanStack Start's Cloudflare target, using the same account as the edge and deploying it with `wrangler`.

## Alternatives Considered

### Vercel

- Pros: polished TanStack Start hosting and preview deploys per PR
- Cons: a second platform, account and bill
- Rejected: one platform is simpler to run and to document for forks

### Netlify

- Pros: TanStack Start support and previews
- Cons: a second platform as well
- Rejected: same reason

## Consequences

- One Cloudflare account covers the Loft, the edge, R2 and KV, with one deploy tool.
- The Loft's build must target Workers. Avoid Node-only APIs in server routes, or enable `nodejs_compat` where needed.
- Preview deployments per PR (`add-pr-preview-environments`) would also use Workers.

## Related

- Task: tasks/done/choose-loft-hosting-platform.md
- Deploy: tasks/someday/deploy-to-production.md
