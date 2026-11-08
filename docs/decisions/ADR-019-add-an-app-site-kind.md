# ADR-019: Add an app site kind

## Status

Accepted

## Date

2026-11-08

## Context

Every site today is a set of pages written in the Loft, checked against the HTML house rules (SPEC §12) and published one page at a time. Some sites are better built elsewhere: the first is the surf game for `surf.lofty.page`, a prebuilt static build (an `index.html` plus JS, CSS and media) that lives in its own repo. The house rules forbid scripts on pages, and the Loft's editor, theme panel and per-page publish assume content it can edit.

Hostname routing, R2, immutable versions, Workers Cache and the page security policy already serve any site's `live/index.html`, whatever produced it (SPEC §11, "App sites").

## Decision

A site has a kind, stored as `sites.kind`: `pages` (Loft pages, as today) or `app` (one prebuilt build). A site is one or the other, never both.

- `kind` is optional and a missing value means `pages`, so existing sites need no migration. `kindOf` in `convex/sites.ts` is the one place that reads it.
- An app site's content is its build. `sites.liveBuildId` points at the live row in a new `appBuilds` table, which keeps every deployed build (its files, the hash of its rewritten `index.html`, who deployed it and when) for history and rollback.
- An app site has no pages and no theme. `sites:create` with `"kind": "app"` creates no home page, and creating a page, saving a theme or importing a site into it fails with `app_site`. The Loft hides Pages and Theme for it and says it is deployed from a build.
- The kind is set when the site is created and there is no command to change it.
- Only staff can create app sites (from the CLI) until `lofty.page` is on the Public Suffix List ([ADR-015](ADR-015-give-each-site-a-lofty-page-address.md)), because an app build runs scripts on a `lofty.page` subdomain.

## Alternatives Considered

### Let any page site upload scripts

- Pros: no new kind; a site could mix Loft pages with an app
- Cons: breaks the house rules that every page is checked against, and the Loft would have to edit, preview and publish pages it can't understand
- Rejected: the house rules and the Loft's editing model depend on pages being plain checked HTML

### A separate product for apps, outside `sites`

- Pros: no change to the pages model at all
- Cons: duplicates hostnames, routing, membership, status and audit, which already work per site
- Rejected: an app site needs everything a site has except pages and a theme

## Consequences

- Code that works on pages or themes must refuse app sites; `assertPagesSite` does this in `pageAt`, which every page creation goes through, and in `writeTheme`.
- The coming-soon page, status toggle, domains and enquiries work for app sites unchanged.
- Converting a site between kinds would mean deciding what happens to its pages or builds, so it isn't offered. Create a new site instead.
- Later app-site work (serving build files, deploys, tokens, build history) builds on `kind`, `liveBuildId` and `appBuilds`.

## Related

- Task: tasks/done/add-app-site-kind.md
- Spec: SPEC §11, "App sites"
