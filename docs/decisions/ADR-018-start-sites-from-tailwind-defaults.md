# ADR-018: Start sites from Tailwind's defaults

## Status

Accepted

## Date

2026-10-28

## Context

[ADR-004](ADR-004-html-pipeline-libraries.md) made a class valid only if Tailwind could compile it against the site's theme _with the default colours, fonts, radii and shadows reset_. It banned every arbitrary value (`[...]`, `(...)`), and it made any class the theme couldn't compile a publish-blocking error. SPEC §12 says the same: colours come only from the site's theme tokens, so a rebrand is a theme change.

In practice that meant Tailwind HTML pasted into the Loft (from Tailwind Plus, v0, a blog post or another site) failed on almost every line:

- A site made by `sites:create` has an empty theme, so after the reset it had no colours, fonts, radii or shadows at all. `bg-gray-900`, `rounded-lg` and `shadow-sm` were all errors.
- Copied code is full of arbitrary values such as `max-w-[1200px]` and `bg-[#0f172a]`.
- A component class from another site's theme (`eyebrow`, `btn`) blocked the publish, even though without that theme it just produces no CSS.
- Only the CLI (`seed:importSite`) could set a site's theme.

The first sample page published on production failed with dozens of "isn't a theme class" errors until its theme was loaded by hand.

The class rules aren't what keeps a page safe. Classes only become CSS in the page's own stylesheet. The sanitiser strips scripts, `style` attributes and handlers. The page CSP (`packages/core/src/headers.ts`, `default-src 'self'; img-src 'self' data:; style-src 'self'`) stops any CSS from loading third-party fonts or images.

## Decision

- **Tailwind's defaults are the baseline.** `loadTheme` no longer prepends a reset. A site's theme is layered on top of Tailwind's default theme, so an empty theme is plain Tailwind. A site that wants only its own tokens opts in by starting its theme with `--color-*: initial;`, `--font-*: initial;`, `--radius-*: initial;` and `--shadow-*: initial;`. `sites/r2c2/theme.css`, the seed theme and the test fixture do that, so they stay as strict as before.
- **Arbitrary values are allowed, except `url(`.** Any class Tailwind compiles is accepted. A class containing `url(` is an error (`no-url`), because images come from the site's media.
- **Unknown classes warn.** A class the theme can't compile becomes an `unknown-class` warning ("… doesn't match anything in this site's theme, so it has no effect."), not an error. Every other house rule stays an error.
- **Owners edit the theme in the Loft.** `theme:save` (a `"use node"` action) checks that the theme compiles and is at most 100 KB, then saves it through the internal mutation `sites:setTheme` with a `site.theme` audit entry. Owners only, like rename and status.

This amends ADR-004's class rules. Everything else in ADR-004 stands: the libraries, `candidatesToCss()` for validity and `compile()` for the CSS.

## Alternatives Considered

### Pages carry their own theme in a `<style type="text/tailwindcss">` block

- Pros: a pasted page brings everything it needs.
- Cons: every page has its own palette, so a rebrand means editing every page.
- Rejected: it breaks SPEC §11's "reference what's design".

### Keep the reset and ship a default theme with common Tailwind colours

- Pros: keeps SPEC §12's wording.
- Cons: still fails on arbitrary values and on any colour that wasn't copied in.
- Rejected: pasted code still wouldn't just work.

### Keep unknown classes as errors

- Pros: catches typos.
- Cons: blocks the publish for a class that has no effect on the output, which is the error that stopped the sample page.
- Rejected: a warning still points out the typo.

### Rewrite pasted classes to the nearest theme token

- Rejected for now: lossy and surprising. It fits better with AI editing later.

## Consequences

- Pasting Tailwind HTML into a page on a site with an empty theme publishes as is. Pasting a site's `theme.css` into the Theme section makes its component classes work, without the CLI.
- Brand drift is possible: `bg-blue-500` can creep into a branded site unless its theme opts in to the reset. The `prefer-components` warning stays.
- Typos in class names no longer block a publish. They show as warnings in the editor and in a publish's result.
- Themes already stored in a database gain the default palette. That only adds valid classes, so nothing that passed before now fails. Re-saving a theme with the reset block makes it strict again.
- A saved theme doesn't restyle live pages until each page is published again, because each page's CSS is compiled at publish.

## Related

- Plan: docs/plans/make-pasted-tailwind-just-work.md
- Amends: [ADR-004](ADR-004-html-pipeline-libraries.md)
