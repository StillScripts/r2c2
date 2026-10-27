# ADR-016: Deploy production from GitHub Actions

## Status

Accepted

## Date

2026-10-27

## Context

T23 takes milestone 1 to production. Three things have to be deployed:

- the Convex production deployment
- the edge Worker on `lofty.page` and `*.lofty.page`
- the Loft Worker on `workers.dev` (ADR-010)

Order matters. The Workers call Convex functions, and published pages depend on routes written by Convex, so Convex has to be live first. CI (`.github/workflows/ci.yml`) already runs check, test and build on every push to `master`.

## Decision

Deploy production from a GitHub Actions workflow, `.github/workflows/deploy.yml`.

- **Trigger.** It runs on `workflow_run` once CI succeeds on a push to `master`, and on `workflow_dispatch` for the first deploy and for re-runs. It deploys the commit that CI checked.
- **Order.** One job runs three deploy steps in sequence: `convex deploy`, then the edge (`wrangler deploy --env production`), then the Loft (`vp build` and `wrangler deploy`). Each package has a `deploy` script, so people and CI run the same commands.
- **Credentials.** Secrets live in a `production` GitHub environment: a Convex production deploy key, and a Cloudflare token limited to Workers Scripts and Workers Routes on `lofty.page`. Runtime secrets stay on the Convex deployment and the Workers, not in GitHub.
- **Missing setup.** A step whose credentials aren't set yet skips with a notice instead of failing.
- **One at a time.** Deploys share a concurrency group and never cancel each other.

The one-time setup is in `docs/deploy.md`.

## Alternatives Considered

### Deploy by hand from the CLI

- Pros: nothing to set up in GitHub, and no deploy credentials stored outside the owner's machine
- Cons: releases depend on one person remembering the order and having the right login
- Rejected: the owner wants deploys to be repeatable from the first release

### Cloudflare Workers Builds (Cloudflare's GitHub integration)

- Pros: no Cloudflare token stored in GitHub
- Cons: it builds each Worker on its own, so it can't deploy Convex first, and it adds a second place to configure builds
- Rejected: the order matters more than one fewer secret

### Repeat CI's checks inside the deploy workflow

- Pros: one workflow file, with no `workflow_run` indirection
- Cons: the checks run twice, and the two copies can drift
- Rejected: `workflow_run` reuses the run CI already did

## Consequences

- Every merge to `master` reaches production once CI is green. A broken change has to be reverted or fixed forward, so there is no manual release gate. A required reviewer on the `production` environment can add one later.
- Deploy credentials live in GitHub. Their scope is kept narrow, and they can't read sites or enquiries.
- Workers and Convex can be briefly out of step during a deploy. Convex goes first, so a new Worker never calls a function that isn't there yet. A change that removes a function the old Workers call still needs two releases.
- Preview environments per PR (`add-pr-preview-environments`) can add to this workflow later.

## Related

- Plan: docs/plans/deploy-to-production.md
- Task: tasks/done/deploy-to-production.md
- Hosting: ADR-010
