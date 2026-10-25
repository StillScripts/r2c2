# ADR-013: Build the docs site with Astro Starlight

## Status

Accepted

## Date

2026-10-25

## Context

The repo is going open source and needs a docs site for contributors. It also holds three kinds of Markdown that should be readable there without being moved: plans (`docs/plans`), decisions (`docs/decisions`) and tasks (`tasks/`). Tasks need a custom view, a roadmap and a completed page, rather than one page per file.

## Decision

Add `apps/docs`, an Astro site using Starlight. An Astro integration (`src/sync-content.ts`) copies the three folders into `src/content/` on every dev start and build, and again on change in dev. Plans and decisions render as Starlight pages; tasks are their own content collection, rendered by custom pages wrapped in `StarlightPage`.

## Alternatives Considered

### VitePress

- Pros: Vite-native, fast, Markdown-first
- Cons: Vue for custom pages, while the rest of the repo is React and TypeScript; custom collections like tasks take more work
- Rejected: Starlight's content collections fit the tasks view better

### A route in the Loft

- Pros: no new framework
- Cons: mixes public docs into the staff app and its auth
- Rejected: docs should build and deploy on their own

## Consequences

- Astro runs on the repo's Vite+ core through the `vite@*` override, so an Astro upgrade that needs a newer Vite waits on Vite+.
- The copied folders are ignored by git; the originals stay the source of truth.
- Repo frontmatter is loose YAML (unquoted `: ` in titles), so the copy step quotes those values; ADRs have no frontmatter and take their title from the `#` heading.
- Publishing the site is still to do (`publish-docs-site-on-r2c2`).

## Related

- Task: tasks/done/add-starlight-docs-site.md
