---
title: Add a theme panel to the Loft
depth: simple
created: 2026-11-01
---

# Add a theme panel to the Loft

Make the Theme section that shipped in [make-pasted-tailwind-just-work](make-pasted-tailwind-just-work.md) into the "one small theme panel with a live preview" from SPEC §11: its own Loft page where an owner edits the theme's CSS or picks its colours and sees one of the site's pages re-render with the unsaved theme before saving.

## Scope

- In:
  - A `/sites/$siteId/theme` route, owner only. It replaces the inline `ThemeEditor` on the site page with a "Theme" link.
  - A live preview of a chosen page's draft (home page by default) rendered with the unsaved theme.
  - A colour picker for each `--color-*` token in the theme's `@theme` block, plus "Add colour". Pickers rewrite the CSS text, so the textarea stays the source of truth.
  - Saving still goes through `theme:save`.
- Out:
  - Pickers for fonts, radii and shadows.
  - Kit themes (`add-site-kits-dental-clinic`).
  - Republishing pages when the theme changes. The panel keeps its one line saying published pages update when they're next published.
  - A built-in style sheet preview.
  - Previewing sites that have no pages. The preview says to create a page first.

## Approach

- **Backend:** a new owner-only `"use node"` action, `theme:preview({ siteId, theme, html })`, in `packages/backend/convex/theme.ts`. It returns `{ ok: true, css }`, or `{ ok: false, message }` from `themeProblem`.
  - It reuses `loadTheme` and `compileCss` from `@workspace/html`, and the same owner check as `theme:save` (pulled into a shared helper).
  - It's a separate action, not a `theme` argument on `preview:preview`. That keeps the page editor's action open to editors and keeps theme compiling owner-only.
- **Loft:** the route is laid out like the page editor, with the editor on the left and the preview on the right.
  - Left: the colour pickers above the CSS textarea, then the compile error if there is one.
  - Right: a page `<select>` (from `pagesQuery`) and `PreviewFrame`.
  - The preview is debounced like `usePreview`, through a shared `useDebouncedResult` hook. If the theme stops compiling, the last preview that compiled stays on screen under the error.
  - Cmd/Ctrl+S and the unsaved-changes guard move into a shared `useEditorGuards` hook used by both editors.
- **Colour tokens:** pure helpers in `apps/loft/src/lib/theme-colours.ts`:
  - `readColours(css)` finds `--name: value;` declarations inside the first `@theme { … }` block. It skips the `--color-*: initial` reset line.
  - `setColour(css, name, value)` replaces one declaration's value.
  - `addColour(css, name, value)` inserts a declaration at the end of the block, and creates the block if there isn't one.
  - Hex values get `<input type="color">` plus a text field. Any other value (`oklch(…)`, `var(…)`) gets a text field only.

## Action items

- [x] Add `theme:preview` to `packages/backend/convex/theme.ts`, sharing the owner check with `theme:save`. Add `convex-test` tests for an owner, a non-owner and a theme that doesn't compile.
- [x] Add `readColours`, `setColour` and `addColour` in `apps/loft/src/lib/theme-colours.ts`. Test them with `sites/r2c2/theme.css`, an empty theme, a theme without `@theme`, comments and non-hex values.
- [x] Pull the debounce-and-drop-stale logic out of `usePreview` in `apps/loft/src/components/page-preview.tsx` so the theme preview can reuse it.
- [x] Add `apps/loft/src/routes/_authed/sites/$siteId/theme.tsx` with the pickers, textarea, page select and preview, keeping Cmd/Ctrl+S, the unsaved-changes guard and the published-pages note.
- [x] Replace `ThemeEditor` on `apps/loft/src/routes/_authed/sites/$siteId/index.tsx` with a "Theme" link for owners. Redirect non-owners who open the theme route back to the site page.
- [x] Update references to the Theme section's location (`sites/r2c2/README.md`). SPEC §11 doesn't name one, and ADR-018 stays as written.
- [x] Run `vp check` and `vp test`.
- [ ] Manually: in local dev, change `--color-brand` on the r2c2 site with a picker and watch the home page preview change, break the CSS and see the compile error, then save.

## Open questions

- Should editors see the theme panel read-only? This plan assumes no, matching rename and status, which are owner-only.
