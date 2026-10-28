# ADR-004: Build the HTML pipeline on htmlparser2, sanitize-html, html-validate and Tailwind

## Status

Accepted. The class rules are amended by [ADR-018](ADR-018-start-sites-from-tailwind-defaults.md): Tailwind's defaults are no longer reset, arbitrary values are allowed except `url(`, and unknown classes warn.

## Date

2026-10-25

## Context

Every page is checked and sanitised at publish in `packages/html` (SPEC §4, §7, §12). The HTML is untrusted: it comes from people, the Loft's AI and MCP clients. A failing check must return fixable errors with line numbers. The published HTML must be safe even if a check misses something. Class rules have to follow each site's Tailwind theme, not a fixed list.

## Decision

- **Parse** with `htmlparser2` and `domhandler`, keeping start indices so every node maps to a line and column. The check, element IDs and form extraction share one parse.
- **Check** with our own house rules over that tree, driven by one allow-list (`allowlist.ts`). Structure and accessibility (heading order, one `h1`, labelled fields, link text) go through `html-validate` with a pinned rule config.
- **Sanitise** with `sanitize-html`, configured from the same allow-list, as the last step and as a backstop. If it changes the parsed structure of a page that passed the check, the publish fails instead of shipping a silently changed page.
- **Classes** are valid only if Tailwind can compile them against the site's theme, with the default colours, fonts, radii and shadows reset. Validity comes from `__unstable__loadDesignSystem(...).candidatesToCss()`, wrapped in one function in `theme.ts`. The CSS comes from the public `compile()`. All arbitrary values (`[...]`, `(...)`) are banned.

## Alternatives Considered

### Hand-written sanitiser over our own parse

- Pros: one parse, no second library
- Cons: a home-grown sanitiser is where XSS bugs live
- Rejected: sanitize-html is pinned in SPEC §2 and well-tested

### parse5

- Pros: spec-compliant tree building, good positions
- Cons: sanitize-html parses with htmlparser2, so the check and the sanitiser would see different trees
- Rejected: one parser family for both

### Regex rules for theme classes

- Pros: no Tailwind dependency in the checker
- Cons: can't tell theme classes from typos or default-palette colours
- Rejected: Tailwind already knows what compiles

### Public `compile()` only, building each class on its own

- Pros: no unstable API
- Cons: one build per class
- Rejected for now; it's the fallback if `candidatesToCss` changes

## Consequences

- `checkPage` and `loadTheme` need Node APIs (html-validate, reading Tailwind's CSS), so they run in `"use node"` Convex actions, never at the edge.
- `tailwindcss` stays pinned, and upgrades must re-run the `theme.ts` tests because they rely on an unstable API.
- The allow-list leaves out `svg`, `math`, `template`, `noscript`, `style` and `script`, which closes the usual mutation-XSS routes. Supporting inline SVG later would need a new decision.
- Sanitising drops the doctype, so T13 adds it back when it assembles the published document.

## Related

- Plan: docs/plans/build-html-pipeline-package.md
