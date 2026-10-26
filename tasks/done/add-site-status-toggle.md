---
title: Let owners take a site live from the Loft
created: 2026-10-26
completed: 2026-10-26
---

A new site starts as `coming-soon`, and the edge shows a holding page on every path until it is `live`. The backend already has `sites:setStatus` (owner only, audited, and it syncs the route entries to KV), but nothing in the Loft calls it, so the only way to launch a site is `convex run` with an `--identity`.

- Add a control on the site page, for owners only, that switches between Coming soon and Live and shows the current status
- Say that the change can take about a minute to reach the edge (KV), and warn before going live if the site's `/` page isn't published yet

Found taking the r2c2 seed site live in dev to view it at the local edge.

Related: [SPEC §4](../../SPEC.md#4-how-it-works), [SPEC §5](../../SPEC.md#5-contracts-packagescore)
