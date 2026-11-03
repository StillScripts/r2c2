---
title: Add the Harbour, Coast and Alps views
depth: detailed
created: 2026-11-02
---

# Add the Harbour, Coast and Alps views

Put the chosen view (Harbour, Coast or Alps) behind every signed-in Loft screen, with a switcher in today's header and the choice saved per user in Convex. It's step 2 of the design spec's build order. It builds on the glass tokens from #45, so the branch starts from `master` once #45 has merged, and the shell reskin that comes next builds on this layer.

## Context

- [Design spec §5](../design/loft.md#5-views) gives the views, the layers (scene, vignette, desktop window frame, optional dim, content), the cross-fade and the header switcher. [ADR-017](../decisions/ADR-017-call-loft-scenes-views.md) settles the word "view" and the ids `harbour`, `coast` and `alps`, stored per user, never on a site.
- The art is three self-contained 1440×900 SVGs plus `window-plant.svg`, in `docs/design/loft/views/` (10–14 KB each).
  - Each carries a C2PA content-credentials block, and we keep it.
- `packages/ui` already has the glass tokens and the `glass` utility (#45). Glass falls back to solid `#161a2a` under reduced transparency, and a global rule stops motion under reduced motion.
- `apps/loft/src/routes/_authed.tsx` is the signed-in layout: a plain bordered header with "Loft", your email and Sign out, then `<Outlet />`. Its loader already loads `api.staff.me`, so anything on `me` is there on first paint, with no flash.
- Today's screens are bordered boxes on a transparent background. Over a bright view (the Coast sky), their text would sit straight on the art. The shell reskin (`reskin-loft-in-views-shell`) gives each screen glass, but it isn't built yet.
- Users are Better Auth users. `memberships.userId` holds the auth user id (`identity.subject`, `user._id` in `staff.me`).
- There are no per-user settings yet. Spec §12 suggests a preferences table holding `view` now and `lastSeenAt` later (for Home).

## Approach

**Data.**

- A `preferences` table: `{ userId: string, view: "harbour" | "coast" | "alps" }`, indexed `by_user`.
  - `view` is a `literals` validator in `validators.ts`.
  - The row is created on first change, so a user with no row gets Harbour.
- `staff.me` returns `view`, so the layout has it on first render.
- `preferences.setView({ view })` is a mutation for any signed-in user. It upserts the caller's row.
- `lastSeenAt` is left for the Home task. It adds an optional field then.

**Assets.**

- Move the four SVGs from `docs/design/loft/views/` to `apps/loft/public/views/`, so there's one copy, and point the spec's links there.
- Add `apps/loft/public/views/**` to the formatter's `ignorePatterns` in the root `vite.config.ts`. `docs/design/loft/**` is ignored today, and reformatting could damage the C2PA blocks.
- They're served as static files and drawn with `<img>`, so the browser caches them and they stay out of the JS bundle.
- `VIEWS` in `apps/loft/src/lib/views.ts` maps each view id to its label and Lucide icon (`Building2`, `Waves`, `MountainSnow`). Its type is keyed by the schema's view ids, so a new id can't type-check without an entry. The art is `/views/<id>.svg`. Adding a view later means adding one SVG, one validator value and one entry.

**`LoftView` component** (`apps/loft/src/components/loft/loft-view.tsx`, the folder spec §12 suggests). A fixed, full-bleed stack behind the content, with everything `aria-hidden` and `pointer-events-none`:

1. **Scene:** `<img>` with `object-cover object-bottom` (centre-bottom crop). The `ground` colour shows behind it while it loads.
2. **Vignette:** the spec's radial gradient.
3. **Window frame**, from `md` up: a beam, a transom, two mullions and the plant SVG, sized and placed exactly as in §5.

When the view changes, the new image is drawn underneath and the old one fades out over it in 600ms, as spec §4.6 says. A 600ms timer then removes the old one. It doesn't wait for `transitionend`, which never fires when the global reduced-motion rule cancels the transition. Under reduced motion the swap is instant. The screen dim from §5 layer 4 isn't needed until Home or voice exist, so it's left out.

**Switcher.**

- A segmented control (radio group semantics, three icon-plus-label buttons) in the existing header.
- The local time sits beside it in mono (`7:12 pm`). It renders only on the client, after mount, so it can't mismatch the server-rendered HTML, and it updates on the minute.
- Selecting a view updates it optimistically (Convex `withOptimisticUpdate` on `staff.me`) so the cross-fade starts at once, then saves.
- The phone placement (profile menu) arrives with the shell. Until then, below `sm`, only the selected segment keeps its label, so the view's name still shows, as spec §5 asks.

**Keeping today's screens readable.**

- The header becomes a glass bar.
- The `<Outlet />` sits inside one glass panel. The panel fits its content, so the view shows below short screens. The page editor and theme panel take a shared `fullHeight` class sized to the header and padding.
- This is a deliberate stopgap: the shell reskin replaces it with per-screen glass. It's one wrapper in `_authed.tsx`, so no screen changes now.
- Glass must not be nested (§4.2). Anything inside the wrapper that uses `glass` (a `glass` Button variant, for instance) switches to a `fill-*` colour.

## Alternatives considered

- **Inline the SVGs as React components:** they'd ship in the JS bundle on every route and lose browser caching, for no gain. The art never needs styling from code.
- **Keep the SVGs in `docs/` and import them across packages:** two places would claim to own the art, and a Vite import reaching outside the app is fragile.
- **Store the view in `localStorage`:** it wouldn't follow you to a second device, which the task requires. A cookie would also avoid a flash, but `me` is already loaded before render.
- **A generic key-value settings table:** looser typing for no current need. A typed row per user grows cleanly to `lastSeenAt`.
- **Wait for the shell before showing views:** it would split the "done when" in two. The glass wrapper keeps this task shippable on its own.

## Scope

- In: the `preferences` table and `setView`, `view` on `staff.me`, `LoftView` with the cross-fade and window frame, the header switcher and time, the interim glass wrapper, moving the SVGs, and spec link updates.
- Out:
  - The shell (wordmark, site switcher, jobs pill, avatar) and per-screen glass: `reskin-loft-in-views-shell`.
  - Screen dims, picking a view by time of day, the phone profile menu, and a view on the sign-in page.

## Action items

- [x] Add a `view` validator (`harbour`, `coast`, `alps`) to `packages/backend/convex/validators.ts` and a `preferences` table, indexed `by_user`, to `schema.ts`.
- [x] Add `packages/backend/convex/preferences.ts` with `setView`, which needs a signed-in user and upserts their row. Return `view` (defaulting to `harbour`) from `staff.me`.
- [x] Add `convex-test` tests:
  - A new user gets Harbour.
  - `setView` saves and `me` returns it.
  - A second `setView` updates the same row.
  - Signed-out callers are refused.
  - One user's view doesn't change another's.
- [x] Move `docs/design/loft/views/*.svg` to `apps/loft/public/views/` and update the links in `docs/design/loft.md` (§5, §13 and the header).
- [x] Add `apps/loft/public/views/**` to the formatter's `ignorePatterns` in `vite.config.ts`.
- [x] Add `apps/loft/src/lib/views.ts` (`VIEWS` with ids, labels, icons and files) and `apps/loft/src/components/loft/loft-view.tsx` (scene, vignette, desktop frame and plant, and the cross-fade).
- [x] Add the segmented view switcher and the local time to the header in `apps/loft/src/routes/_authed.tsx`, with an optimistic update on `staff.me`. Make the header glass and wrap `<Outlet />` in one glass panel. Swap any nested `glass` inside routes for `fill-*`, and fix the full-height calc in `pages/$pageId.tsx` and `theme.tsx`.
- [x] Test the cross-fade bookkeeping: the old view is kept until the new one finishes, and switching quickly doesn't stack layers. (`VIEWS` is checked against the schema's ids by its type, not a test.)
- [x] Run `vp check`, `vp test` and `vp run build`.
- [ ] Manually: in local dev, switch views and watch the cross-fade, reload and see the same view, sign in on a second browser and see the same view. Check the frame is gone at phone width and the art and frame are skipped by a screen reader.

## Testing

- **Backend:** `convex-test` suites for `preferences.setView` and `staff.me`'s `view`, including the default, an update and isolation between users.
- **Loft:** a unit test for the cross-fade state (`switchView`, a pure helper that tracks which view layers are shown). `VIEWS` is typed by the schema's view ids.
- **Manual:**
  - Cross-fade, reduced motion (an instant swap), and reduced transparency (solid glass).
  - The phone width (no frame, labels hidden).
  - The reload and second-device checks.
  - Screen-reader skipping (`aria-hidden` on the whole layer).
- **Edge cases:**
  - A user with no preferences row.
  - Switching views several times faster than 600ms (only the newest and the one fading out are drawn).
  - The time on first paint (blank until mount, with no hydration warning).
  - A slow image load (the `ground` colour shows).
  - Every existing route still readable over Coast, the brightest view.

## Risks

- **Readability before the reskin:** today's screens over the art. Mitigation: the single glass wrapper, checked over Coast.
- **The full-height screens:** the page editor (`pages/$pageId.tsx`) and the theme panel (`theme.tsx`) both use `h-[calc(100svh-3.5rem)]`, and the wrapper's padding could push them past the screen. Mitigation: share one height class that subtracts the header and the wrapper's padding. Checked in the manual pass.
- **The spec's links break when the SVGs move:** the docs site renders the spec. Mitigation: update every link in the same commit.

## Decisions

- [ADR-017](../decisions/ADR-017-call-loft-scenes-views.md) already covers naming and per-user storage. The `preferences` table follows spec §12, which suggests a per-user preferences table, so no new ADR is needed.

## Open questions

- Should new users get Harbour? Spec §14 still lists this, and the plan follows its assumption.
