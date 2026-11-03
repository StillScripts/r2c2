---
title: Move the Loft's screens into the views shell
depth: simple
created: 2026-11-03
---

# Move the Loft's screens into the views shell

Replace the stopgap header and single glass panel from `add-loft-views` with the shell in [design spec §6](../design/loft.md#6-the-shell). It has a wordmark pill that links home, a site switcher pill with a menu that reaches each site's screens, and a view pill (the view's name, the time and your avatar) that opens a menu holding the view switcher, your email and Sign out. Today's screens move into it with their own glass, and keep working as they do.

## Scope

- In:
  - **Header:** the wordmark, the site switcher and its menu, and the view pill and its menu.
  - **Each screen restyled:** sites, a site's pages, the HTML editor, history, enquiries and an enquiry, and the theme panel.
  - **Site badges:** each site's badge colour comes from its theme's `--color-brand`.
  - **Phone header:** a 44px home button, the site badge and the avatar.
  - **Spec update:** the §5 switcher placement in the spec.
- Out:
  - Home (`build-loft-home-screen`), the jobs pill (`add-loft-background-jobs`), and the conversation.
  - Any behaviour change to the screens.
  - The sign-in page.

## Approach

**Header.**

- **Left:** the wordmark pill (the Loft mark and "The Loft" in serif) links to `/`. Then the site switcher pill, inside `/sites/$siteId/*` only: the site's badge, its name and a chevron.
  - Its menu lists **Pages**, **Enquiries** (with the new count), and **Theme** for owners.
  - Then your other sites, and **All sites**.
- **Right:** the view pill (the view's name, `LocalTime` and the avatar initials) opens a menu with the view switcher (today's `ViewSwitcher`), your email and **Sign out**.
- **Phone:** the pills shrink to the 44px home button, the site badge with its chevron, and the avatar. The same menus open from them.

**Menus.** A `Menu` component added to `packages/ui` from shadcn's Base UI dropdown menu. `@base-ui/react` is already a dependency of `packages/ui`, so nothing new is installed. The menus are glass, with `fill-*` items, since glass isn't nested.

**Screens.**

- The single glass wrapper goes. Each screen's `main` becomes its own glass panel, at the spec's content widths.
- The bordered boxes inside become `fill-1` rows and cards.
- In-screen links to other screens (the site page's "Enquiries" and "Theme" links, the enquiries "Pages" link) move to the site switcher's menu. Links that belong to the screen stay: the editor's History link, an enquiry's link back to its list, and the page list.
- `fullHeight` is re-measured for the new header.

**Badges.**

- `staff.me` adds each site's `brand`: the `--color-brand` value in its theme, or none, in which case the badge falls back to `fill-3`.
- The badge's initials are the first two characters of the site's name.

## Action items

- [ ] Add `brand` to each site in `staff.me` (read with a small helper from `sites.theme`), with tests for a theme with a brand colour, one without, and an empty theme.
- [ ] Add a `Menu` component to `packages/ui/src/components/` based on shadcn's Base UI dropdown menu, styled as glass.
- [ ] Add `apps/loft/src/components/loft/`:
  - `shell-header.tsx`, holding the wordmark, the site switcher and the view pill.
  - `site-badge.tsx`
  - `loft-mark.tsx`, the Loft mark SVG from the reference files.

  `ViewSwitcher` moves into the view pill's menu.

- [ ] Rework `apps/loft/src/routes/_authed.tsx` to use the header and drop the single glass wrapper. Re-measure `fullHeight`.
- [ ] Restyle each screen with its own glass and `fill-*` rows:
  - `_authed/index.tsx` and `sites/$siteId/index.tsx`
  - `pages/$pageId.tsx` and `pages/$pageId_.history.tsx`
  - `enquiries/index.tsx` and `enquiries/$enquiryId.tsx`
  - `theme.tsx`

  Move the cross-screen links into the site menu.

- [ ] Update spec §5 so the view switcher lives in the view pill's menu on every screen size.
- [ ] Run `vp check`, `vp test` and `vp run build`.
- [ ] Render each screen with the built CSS at 1440px and 390px wide over Coast (the brightest view), and check every route still works. Then in local dev, go through each route and both menus by keyboard.

## Open questions

- Should **All sites** in the menu go to today's sites list? This plan assumes yes, until the Home task replaces that screen.
