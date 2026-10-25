---
title: T22 Write the marketing site content
depth: simple
created: 2026-10-25
---

# Write the marketing site content

Rebuild the homepage design (a Claude design export, kept out of the repo) as the first R2C2 site: a theme in `sites/r2c2/theme.css` and the page in `sites/r2c2/index.html`, plus a contact section using `<site-form name="contact">`. A test holds the page to the house rules, and an import script loads both into the seed site as a draft so it can be published from the Loft.

## Scope

- In:
  - Theme: the design's colours, radii, type scale and page width as `@theme` tokens. Base styles for the body and links. Component classes (`section`, `btn` and its variants, `card`, `prose`, plus a few small ones the design repeats, such as eyebrow labels and chips).
  - Homepage: every section of the design, in the same order and copy, using only theme tokens and component classes. A new contact section goes before the footer, with name, email and message, and a "Contact" nav link.
  - Allowlist: add `code`, `pre`, `sub` and `sup` to the allowed tags. The design uses them, and they're harmless.
  - Import: a `seed:importSite` internal mutation that sets the site's theme and creates or updates each page's draft, recorded in history as a save by `system`. A `vp run --filter @workspace/backend site:import` script reads `sites/r2c2/` and calls it with `convex run`.
- Out:
  - Self-hosted fonts and images. The theme uses system font stacks, and the page has no images until media uploads exist.
  - Publishing to production (T23) and the docs site.

## Adapting the design to the house rules

- **Fonts:** Archivo and JetBrains Mono from Google Fonts become system sans and mono stacks, because pages make no third-party requests. Archivo stays first in the stack, so it's used where it's installed.
- **No SVG:** the GitHub button loses its icon.
- **Loft and MCP mockups:** their fake `<button>`s become styled `<span>`s, so the page has no buttons that do nothing.
- **Docs link:** the design points at `Docs.dc.html`. Until the docs site is live, the link goes to the repo's `docs/` folder on GitHub.
- **Copy accuracy:** "clears that page from the cache" and "clears that page's cache tag" become "the edge picks it up within a minute", because milestone 1 doesn't purge ([ADR-011](../decisions/ADR-011-workers-cache-without-purge.md)). The example response headers match what the renderer actually sends.
- **Accent:** the design's default `#2f3bff`.

## Action items

- [ ] Add `code`, `pre`, `sub` and `sup` to `packages/html/src/allowlist.ts`, with a test.
- [ ] Write `sites/r2c2/theme.css` from the design's values.
- [ ] Write `sites/r2c2/index.html`, section by section, with the contact form.
- [ ] Add `packages/html/src/sites.test.ts`: every `sites/<name>/index.html` passes `checkPage` with its own `theme.css`, with no errors or warnings, and declares the `contact` form.
- [ ] Add `seed:importSite` to `packages/backend/convex/seed.ts`, with tests: it sets the theme, updates an existing page's draft, creates a missing page, and records history.
- [ ] Add `packages/backend/scripts/import-site.ts` and the `site:import` script; document it in the backend README and `sites/r2c2/README.md`.
- [ ] Screenshot the page with its compiled CSS at desktop and phone widths, next to the design, and fix differences.
- [ ] Run `vp check`, `vp test` and `vp run build`.

## Open questions

- "Publishes through the Loft and renders correctly on the local edge" needs a Convex dev deployment and Cloudflare, which a cloud session can't reach. That check is left for you to run on your machine: `site:import`, publish from the Loft, then open `r2c2.localhost`. It also depends on `connect-edge-dev-to-cloudflare`.
