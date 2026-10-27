# ADR-007: Run Convex in US East for now

## Status

Accepted

## Date

2026-10-25

## Context

A Convex deployment's region is set when the deployment is created; moving one later means creating a new deployment and migrating its data. The first sites and the team are in Australia.

- US East (N. Virginia) is Convex's default region and its base price.
- Sydney costs about 30% more but sits next to Australian users and staff.
- Convex is never in the path that serves a page (see the SPEC overview). Visitors get HTML from R2 at the edge. Only Loft editing, enquiry submissions and publishing reach Convex, so its distance from visitors matters much less than it would for a typical app.

## Decision

Run the Convex dev deployment (`tangible-bear-808`, project `r2c2`) in US East. Choose the production deployment's region again before `deploy-to-production`, when real usage shows whether Loft latency from Australia is a problem.

## Alternatives Considered

### Sydney

- Pros: lower latency for Australian staff editing in the Loft and for enquiry writes
- Cons: about 30% higher cost before there is any usage to justify it
- Rejected for now: the gain is limited to staff and form submissions

## Consequences

- Loft edits and enquiry writes from Australia make a round trip to Virginia, roughly 200 ms each.
- Moving the dev deployment later only costs dev data.
- 2026-10-27: confirmed for production at T23. The production deployment also runs in US East.

## Related

- Plan: docs/plans/deploy-to-production.md
- Task: tasks/done/choose-convex-deployment-region.md
- Before production: tasks/someday/deploy-to-production.md
