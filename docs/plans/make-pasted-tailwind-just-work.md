---
title: Make pasted Tailwind HTML just work
depth: detailed
created: 2026-10-28
decisions:
  - docs/decisions/ADR-018-start-sites-from-tailwind-defaults.md
---

# Make pasted Tailwind HTML just work

Copying Tailwind HTML (from Tailwind Plus, v0, a blog post or another R2C2 site) into the Loft's editor should preview and publish without anyone running a Convex command. We'll do that by starting every site from Tailwind's default design system, allowing safe arbitrary values, demoting unknown classes from errors to warnings, and letting staff edit a site's theme in the Loft.

## Context

- `packages/html/src/theme.ts` prepends a `RESET` that wipes Tailwind's `--color-*`, `--font-*`, `--radius-*` and `--shadow-*`, so a site with an empty theme (every site made by `sites:create`) has no colours, fonts, radii or shadows at all. `bg-gray-900`, `rounded-lg` and `shadow-sm` all fail.
- `packages/html/src/check.ts` makes any class containing `[` or `(` an error, and any class Tailwind can't compile an error ("isn't a theme class"). Copied Tailwind code is full of both.
- A site's theme lives on `sites.theme` and is only written by `seed:importSite` through the CLI (`site:import`, which also needs the site's slug to match a `sites/<slug>/` folder). The Loft has no way to set it.
- These rules come from [ADR-004](../decisions/ADR-004-html-pipeline-libraries.md) and SPEC §12 ("colours… only from the site's theme tokens", "no arbitrary values"). The goal was that a rebrand is a theme change. That still holds for sites that opt in. It just shouldn't be the price of entry.
- Safety doesn't depend on the class rules: classes only become CSS in the page's own stylesheet, the sanitiser strips scripts, `style` and handlers, and the page CSP (`packages/core/src/headers.ts`) is `default-src 'self'; img-src 'self' data:; style-src 'self'`, so arbitrary values can't load third-party fonts or images.
- What triggered this: the sample page on prod (`r2c2-site`) failed with dozens of "isn't a theme class" errors until its theme was loaded by hand with `convex run --prod seed:importSite`.

## Approach

**1. Tailwind defaults are the baseline.** Drop the forced `RESET` from `theme.ts`. A site's theme is layered on top of Tailwind's defaults, so an empty theme is plain Tailwind: every default colour, font, radius and shadow works. A site that wants a strict palette says so in its own theme by starting with the reset block (`--color-*: initial;` and friends). `sites/r2c2/theme.css` gets that block, so the marketing site keeps today's strictness. `theme.colours` still lists the theme's own tokens, for hints.

**2. Arbitrary values are allowed, except `url(`.** `w-[1200px]`, `bg-[#0f172a]`, `grid-cols-[1fr_2fr]` and arbitrary properties compile like any other class. A token containing `url(` is an error under a new `no-url` rule ("Images come from the site's media"), which keeps the image rule without leaning on the CSP alone. Tokens Tailwind can't compile (malformed brackets) still fall through to the unknown-class rule.

**3. Unknown classes warn, they don't block.** A class Tailwind can't compile against the theme (`eyebrow` on a site without that `@utility`, `js-toggle`, a plugin class like `prose`) becomes a warning: "`eyebrow` doesn't match anything in this site's theme, so it has no effect." It produces no CSS, so it can't hurt the page. The page still publishes. Every other house rule (tags, attributes, headings, title, description, alt text, forms, size) stays an error.

**4. A theme editor in the Loft.** On the site page, owners (not editors, like rename and status) get a **Theme** section: a monospace `<textarea>` holding `sites.theme` (the page editor is a plain textarea too, `pages/$pageId.tsx`) and a Save button. Saving runs a new `"use node"` action, `theme:save` (`convex/theme.ts`), that compiles the theme with `loadTheme` (as `site:import` already does) and returns readable errors if it doesn't compile; otherwise an internal mutation patches `sites.theme` and writes a `site.theme` audit entry, through a helper shared with `seed:importSite`, which does the same today. Themes are capped at 100 KB. The page editor's live check (`api.preview.preview`, called by `usePreview` in `apps/loft/src/components/page-preview.tsx`) picks up the new theme on its next run, and its `<Issues>` list already shows warnings. Published pages keep the CSS they were published with until they're published again, and the panel says so in one line. This is the minimal version of [add-loft-theme-panel](../../tasks/someday/add-loft-theme-panel.md). Token pickers and a live preview of the theme stay in that task.

**5. `site:import --into <slug>`.** Lets `vp run site:import -- r2c2 --into r2c2-site --prod` load `sites/r2c2/` into a site with a different slug. It's the CLI half of the original task and a small change to `packages/backend/scripts/import-site.ts`: today every `--` argument is forwarded to `convex run`, so `--into` and its value must be pulled out before the rest are forwarded, and before the folder slug is read. `seed:importSite` already takes `slug`, so the backend doesn't change.

After this, pasting the sample page into a fresh site publishes with warnings for its custom component classes (`eyebrow`, `section`, `btn`), and pasting its `theme.css` into the Theme section clears them, with no CLI involved.

## Alternatives considered

- **Pages carry their own theme in a `<style type="text/tailwindcss">` block:** a pasted page would bring everything it needs, but it breaks "reference what's design" (SPEC §11): every page would have its own palette and a rebrand would mean editing every page.
- **Auto-fix on paste (rewrite `bg-gray-900` to the nearest theme token):** clever, but lossy and surprising. It fits better in AI editing later.
- **Keep the strict rules and ship a default theme with the most common Tailwind colours:** still fails on arbitrary values and on any colour not copied in, so pasted code still wouldn't "just work".
- **Keep unknown classes as errors:** the strictest choice, but it's the error that blocked the sample page, and an unknown class has no effect on the output.

## Scope

- In: the four rule changes in `packages/html`, the Loft Theme section and `theme:save`, `site:import --into`, `sites/r2c2/theme.css` opting in to the reset, an ADR, and SPEC §12 and `docs/deploy.md` updates.
- Out: a live theme preview, token pickers and kit themes (`add-loft-theme-panel`, `add-site-kits-dental-clinic`); republishing pages automatically when the theme changes; creating sites from the Loft; AI rewriting of pasted code.

## Action items

- [x] Remove `RESET` from `packages/html/src/theme.ts`, and add the reset block to the top of `sites/r2c2/theme.css`, the seed `THEME` in `packages/backend/convex/seed.ts` and the test `THEME` in `packages/html/src/fixtures.ts`, so existing tests keep their strict palette.
- [x] In `packages/html/src/check.ts`, allow arbitrary values, error on tokens containing `url(`, and move the unknown-class issue from `errors` to `warnings` with the "has no effect" message.
- [x] Update `packages/html/src/check.test.ts`: default palette passes with an empty theme, a reset theme still rejects `bg-red-500` (now as a warning), arbitrary values pass, `bg-[url(...)]` errors, and unknown classes warn without blocking.
- [x] Add a test that a page with only warnings publishes (`buildRelease` in `packages/html/src/release.ts` already stops only on errors) and that its compiled CSS includes default-palette and arbitrary classes.
- [x] Add `theme:save` (owner-only `"use node"` action in `convex/theme.ts` → internal mutation `sites:setTheme`) in `packages/backend/convex/`, moving the theme patch and `site.theme` audit out of `seed:importSite` into a shared helper, with tests for a valid theme, one that doesn't compile, one over 100 KB, and a non-owner.
- [x] Add the Theme section to `apps/loft/src/routes/_authed/sites/$siteId/index.tsx` (or its own route if the page gets crowded) as a monospace textarea, and show compile errors inline.
- [x] Add `--into <slug>` to `packages/backend/scripts/import-site.ts`, stripping it and its value before the folder slug is read and the other flags are forwarded, and document it in `sites/r2c2/README.md` and `docs/deploy.md`.
- [x] Record the ADR (below), mark ADR-004's class rule as amended, and update SPEC §12's colour and arbitrary-value bullets.
- [x] Run `vp check` and `vp test`.
- [ ] Manually: in local dev, paste a Tailwind Plus-style section into a page on a site with an empty theme and publish it, then paste `sites/r2c2/index.html` and its theme through the Loft only.

## Testing

- `packages/html`: unit tests for each rule change, plus `sites.test.ts` proving the marketing site still passes with its now-explicit reset.
- `packages/backend`: `theme:save` tests with `convex-test`. `release.test.ts` in `packages/html` proves a page with only warnings still publishes.
- Manual check in the Loft as in the last action item, including the warning list rendering under the editor.
- Edge cases: an empty theme, a theme that sets only some resets (just `--color-*: initial`), very long arbitrary values, and `url(` inside an arbitrary property (`[background:url(x)]`).

## Risks

- **Sites drift from their brand:** with defaults allowed, `bg-blue-500` creeps into a branded site. Mitigation: a theme that opts in to the reset gets today's behaviour, and the `prefer-components` warning stays.
- **Existing themes change meaning:** any theme that relied on the implicit reset would gain the default palette. In the repo, `sites/r2c2/theme.css`, the seed `THEME` and the test fixture `THEME` all get the reset block. Themes already stored in a database (dev seed sites, prod `r2c2-site`) only gain the default palette, which adds classes and removes none, so nothing that passes today starts failing; re-import them to get the strict palette back.
- **Warnings get ignored:** an unknown class silently does nothing. Mitigation: the message says so plainly, and the Loft lists warnings next to errors.
- **`__unstable__loadDesignSystem` changes:** unchanged risk from ADR-004; the tests cover it.

## Decisions

- [ADR-018: Start sites from Tailwind's defaults](../decisions/ADR-018-start-sites-from-tailwind-defaults.md), which amends ADR-004's class rules and SPEC §12.
