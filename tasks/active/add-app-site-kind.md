---
title: Add an app site kind
created: 2026-11-08
---

Add `kind` (`pages` | `app`, missing means `pages`) and `liveBuildId` to `sites`, and an `appBuilds` table (`siteId`, `buildId`, `files`, `htmlHash`, `deployedBy`, `deployedAt`, index `by_site_deployed`). Let `sites:create` take `--kind app`. In the Loft, an app site hides Pages and Theme and says it is deployed from a build. Record the app site kind ADR.

Done when: an app site can be created from the CLI and shows the coming-soon page at its address; page sites behave exactly as before.

Related: [SPEC §11](../../SPEC.md#11-later-specs-outlines), [ADR-019](../../docs/decisions/ADR-019-add-an-app-site-kind.md)
