---
title: Give every site a lofty.page address
created: 2026-10-26
---

Every site gets `<slug>.lofty.page` as its primary domain when it's created, so it can be published and viewed before it has a custom domain. When the owner adds a custom primary domain, the lofty.page address becomes a redirect to it; removing the custom primary makes the lofty.page address primary again. Owners can't add or remove hostnames under the sites domain themselves.

- `SITES_DOMAIN` on each Convex deployment (`lofty.page` in production, `localhost` in dev)
- `sites:create` creates a site from the CLI, with its address, until the Loft can create sites
- Slugs must be single DNS labels and not reserved (`www`, `app`, `api`, …)

Related: [ADR-015](../../docs/decisions/ADR-015-give-each-site-a-lofty-page-address.md), `pick-marketing-site-domain`, `deploy-to-production`
