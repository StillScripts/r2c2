# ADR-015: Give each site a lofty.page address

## Status

Proposed

## Date

2026-10-26

## Context

The project owner registered `lofty.page` (through Vercel Domains) for the marketing site. A new site has no hostname until an owner adds one with `domains:add`, so it can't be viewed at the edge, even as a holding page, until its client's custom domain is ready. Client custom domains through Cloudflare for SaaS are out of scope for milestone 1 (SPEC §11).

The edge already routes purely by hostname (`host:<hostname>` in KV, SPEC §4), so any hostname that reaches the Worker can serve a site.

## Decision

Every site gets `<slug>.<SITES_DOMAIN>` as its address when it is created. `SITES_DOMAIN` is a Convex environment variable: `lofty.page` in production and `localhost` (the default) in dev, where `<slug>.localhost` already resolves to the local edge.

- A slug is one DNS label (lowercase letters, digits and inner hyphens, at most 63 characters) and not a reserved name such as `www`, `app` or `api`, so the address is always one level below the sites domain.
- The address stays with the site for its whole life. Owners can't remove it, and can't add any hostname at or below the sites domain, so no site can take another's address.
- The address is stored as a domain of kind `address` and never changes. `primaryDomain` in `@workspace/core` decides where a site is served: its active custom primary if it has one, otherwise its address. Every other hostname, the address included, redirects there. A pending custom primary leaves the site on its address until the custom domain is active.
- `sites:create` (an internal mutation run from the CLI, like `staff:create`) creates sites until the Loft can.

## Alternatives Considered

### No default address

- Pros: no new rules; a site only ever has the domains its owner adds
- Cons: a site can't be seen or checked at the edge until a custom domain is set up
- Rejected: the whole point is that a site works from day one

### Paths on one domain (`lofty.page/<slug>/…`)

- Pros: one hostname and one certificate
- Cons: breaks hostname routing, root-relative links and per-site caching, and every page would need rewriting when it moves to a custom domain
- Rejected: the edge, KV entries and published HTML all assume a site owns its hostname

### Deeper addresses (`www.<slug>.lofty.page`)

- Pros: matches the `www` pattern of custom domains
- Cons: Cloudflare's Universal SSL certificate covers only `lofty.page` and `*.lofty.page`; deeper names need Advanced Certificate Manager
- Rejected: one label is enough for a default address

## Consequences

- `lofty.page` must be a zone on Cloudflare (its nameservers changed at Vercel) so that a proxied wildcard record and a `*.lofty.page/*` Worker route can send every address to the edge. This is part of T23.
- The marketing site's own `lofty.page` and `www.lofty.page` sit inside the sites domain, so owners can't add them with `domains:add`. T23 attaches them from the CLI.
- Site pages are served from subdomains of `lofty.page`, where a page could set cookies for `lofty.page` that its neighbours would receive. Keep the Loft, and anything else that uses cookies, off `lofty.page` unless `lofty.page` is added to the Public Suffix List first.
- A slug can't change without changing the site's address, so there is no slug rename.

## Related

- Task: tasks/done/give-sites-lofty-page-hostnames.md
- Task: tasks/done/pick-marketing-site-domain.md
