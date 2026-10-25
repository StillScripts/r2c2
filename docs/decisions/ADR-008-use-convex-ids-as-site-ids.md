# ADR-008: Use the Convex document ID as the public site ID

## Status

Accepted

## Date

2026-10-25

## Context

A site's ID leaves Convex and ends up in several other systems (SPEC §5):

- KV routing entries (`host:<hostname>` → `{ site }`)
- R2 keys (`sites/<siteId>/...`)
- cache tags (`site-<siteId>`)
- the signed `x-r2c2-site` header between the Worker and Convex

Once pages are published, changing a site's ID means rewriting every R2 object and KV entry for it. SPEC's example `s_r2c2` was only a placeholder.

## Decision

The public site ID is the `_id` of the site's row in the Convex `sites` table, for example `k17f3ana2bs2vfzvjxh5a1tsss8gzwng`. Convex functions take it as `v.id("sites")`.

## Alternatives Considered

### The slug

- Pros: readable in R2, logs and cache tags
- Cons: renaming a site would mean rewriting its R2 keys and KV entries
- Rejected: an ID that leaves the database should never change

### A separate `publicId` field

- Pros: decoupled from Convex's ID format
- Cons: one more index and lookup on every request that comes from the edge, and one more value to keep unique
- Rejected: no gain over the document ID while Convex is the only backend

## Consequences

- IDs never change. They are lowercase letters and digits, so they're safe in R2 keys, KV values and cache tags without escaping.
- Convex checks that an incoming site ID is valid for the `sites` table during argument validation, before any lookup.
- Dev and production have different IDs for the same site. Seeds and KV sync have to read the ID from Convex rather than hard-coding it.
- R2 paths aren't human-readable. Debug tools can show the slug next to the ID.

## Related

- Plan: docs/plans/add-convex-backend-schema.md
