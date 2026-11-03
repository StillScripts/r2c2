---
title: Build the Loft home screen
depth: detailed
created: 2026-11-03
---

# Build the Loft home screen

Replace today's sites list at `/` with Home from [design spec §8 A](../design/loft.md#a--home-homedchtml-coast). It shows:

- a greeting by time of day and a one-line summary of what happened since your last visit
- suggestion chips
- "Lately", built from `auditLog` and new enquiries
- your sites

The talk-or-type input is built but stays behind a flag until the conversation ships. Until then, the chips are plain shortcuts to screens.

## Context

- **What Home replaces:** `apps/loft/src/routes/_authed/index.tsx` is a glass panel listing `me.sites`.
- **The shell:** it's in place (#48). Home sits under it, straight on the view, with the greeting and summary as "text on view" (spec §4.2) and panels as glass.
- **Activity sources** (spec §9):
  - **The audit log:** `auditLog` (`by_site_at`) already records `page.publish`, `page.rollback`, `page.create` and `page.restore` with the page's path as `target`, and the actor's user ID.
  - **New enquiries:** these come from `enquiries` with status `new`. `inboxPage` in `enquiries.ts` reads them.
- **Drafts waiting:** nothing records them today. A page has `draftHtml` and `liveVersionId`, but the Loft can't tell whether the draft differs from what's live. You chose to track unpublished edits with a flag.
- **Last visit:** `preferences` holds one row per user (`view`), created on first change. Spec §12 puts `lastSeenAt` there.
- **Site details:** a site's address is `siteAddress(slug)` in `domains.ts`. `brandOf` in `sites.ts` gives the badge colour. `status` is `live` or `coming-soon`.
- **The inbox query:** `inboxPage` and `INBOX_LIMIT` are private to `enquiries.ts`, so this plan exports them for reuse. The "your sites" lookup moves into `memberSites` in `sites.ts`, shared by `staff.me` and Home.

## Approach

**"Since your last visit" without the summary wiping itself.** Home's data is a live query, so writing "seen now" would immediately turn the summary into "nothing new".

- A `visits` table holds `lastSeenAt` and `previousSeenAt`, one row per user. It's kept apart from `preferences` so that a visit doesn't re-run `staff.me`, which reads preferences for the view.
- `home.markSeen` runs when Home mounts. Within a visit it refreshes `lastSeenAt` at most every 5 minutes, so it rarely re-runs the overview. If `lastSeenAt` is more than 30 minutes old, a new visit has started: it moves `lastSeenAt` into `previousSeenAt`. Either way it then sets `lastSeenAt` to now.
- Home measures "since your last visit" from `previousSeenAt`, so it stays put for the whole visit and across reloads within it.
- A first visit has no `previousSeenAt`, and gets a welcome summary instead.

**Drafts waiting.**

- `pages` gains an optional `draftChangedAt` timestamp: set when the draft moves ahead of what's live, absent once it's published. The time lets the chip pick the most recently edited draft.
- `writeDraft` sets it. That covers saving in the editor, restoring an earlier draft, and later the AI. The ID patch in `markLive` (`publishing.ts`) writes to the draft directly and deliberately leaves the flag alone.
- Publishing clears it, but only when the draft still matches what was published. `markLive` already keeps an edit saved while a publish was running, so that edit stays waiting.
- A rollback always sets it. The newer content is still in the draft and is now ahead of what's live. In the rare case where the draft equals the version rolled back to, it may flag a draft that isn't really waiting, and that's acceptable.
- Existing pages start with no flag, so nothing shows as waiting until it's edited again.

**`home.overview` query.** One query for the whole screen, across every site the caller belongs to.

- **`sites`:** id, name, `address`, `status`, `brand` and role, sorted by name.
- **`activity`:** the newest 4 rows, merged across sites.
  - **From the audit log:** one read of each site's newest 50 `auditLog` entries serves both Lately (the newest 20, keeping only the four page actions) and the summary's publishes. Rows are data, `{ kind: "page", action, path, siteId, siteName, at }`, and the Loft words them in `activityRow()` next to the other Home wording ("Published /pricing", "Rolled back /pricing", "Created /pricing", "Restored an earlier draft of /pricing"). Publish and rollback show as live, and create and restore as drafts. Only the rows shown are looked up to link to their page, if it still exists.
  - **From new enquiries:** each site's `new` enquiries grouped by form, as one `{ kind: "enquiry", form, count }` row per group ("2 new enquiries", "From the contact form"), at the newest one's time. A row links to that site's inbox of new enquiries.
  - **No names:** activity carries no actor and no tool names. When teammates exist, rows for other people's actions can gain a name.
- **`summary`:**
  - **Since `previousSeenAt`:** the distinct paths published, from `page.publish` entries with `at` after it (read with the index range, up to 50 per site), and the number of new enquiries that arrived.
  - **Current state, not since your last visit:** the drafts waiting, meaning pages with `draftChangedAt` across your sites (read through a `by_site_draft` index, so other pages aren't loaded), each with its site, path and when it was last edited.

  The "since" parts are null on a first visit.

The cost is bounded: per site, it reads 20 audit rows, up to 100 new enquiries (as the inbox does), and the site's pages.

**Loft screen** (`_authed/index.tsx`, built from the components in spec §7 under `components/loft/home/`):

- **Greeting:** "Morning", "Afternoon" or "Evening" plus your first name (the first word of `me.name`), in serif, as text on the view. Like `LocalTime`, it renders only on the client, because the hour depends on the browser.
- **Summary line:** built from `summary` by a pure `summaryLine()` with tests. For example: "/pricing went live, and 2 new enquiries came in. Nothing needs you yet." Or "1 draft is waiting to be published." "Nothing needs you yet" appears only when no draft is waiting.
- **CoreInput:** built, but rendered only when `CONVERSATION_ENABLED` (a constant in `lib/flags.ts`) is true. Today it's false.
- **SuggestionChips:** up to three, worked out by a pure `suggestions()` with tests:
  - one chip per site with new enquiries, up to two: "Read the 2 new enquiries", linking to that site's inbox (with the site's name when you belong to more than one site)
  - then one chip for the most recently edited draft waiting: "Publish the /how draft", linking to its editor
  - if neither applies → no chip

  Until the conversation ships, chips are links. Afterwards, each chip's text is also the message it sends.

- **Lately:** an ActivityList glass panel with 30px icon chips. Its icons are `Globe` on `live-tint` for live, `Inbox` on lamp for an enquiry, and `File` on `fill-3` for a draft. Each row links to the page, the inbox or the editor. The spec's "All activity" link is left out until there's a page for it.
- **Sites:** a glass panel of SiteRows, each with the badge, the name, the address in mono and a live dot with "Live" or "Coming soon". Each row links to the site. The spec's "New site" row is left out, because sites are still created from the CLI.
- **Dim:** the spec's Home dim (`rgba(8,22,34,0.2)`) over the view. A route sets it with `staticData.viewDim`, the shell passes the deepest screen's dim to `LoftView`, and later screens such as voice and the publish sheet can use the same mechanism.
- **Chips on the view:** until the input ships, the chips sit straight on the view, so each one is a glass pill. Inside the input they use `fill-2`, as in the spec.
- **Local clock:** times and the greeting render through TanStack Router's `ClientOnly`, so the server's HTML can't disagree with the browser's clock. One `clockTime` formatter in `lib/format.ts` serves both `LocalTime` and the activity times.

## Alternatives considered

- **Pass "since" from the client, captured once when Home mounts:** a reload would lose the snapshot, and it couldn't follow you across devices.
- **Compare the draft's hash with the live version's hash:** a page version's hash is of the published output, not the raw draft, so the two don't compare directly.
- **A stored activity feed table:** an extra write on every action, when `auditLog` already holds this.
- **Hide the chips until the conversation ships:** you chose shortcuts, so Home is useful now.

## Scope

- In:
  - the `preferences` and `pages` fields, `home.markSeen` and `home.overview`
  - `draftChangedAt` maintained by `writeDraft`, publish and rollback
  - the Home screen with its greeting, summary, chips, Lately and Sites
  - CoreInput behind a flag, and the Home dim
- Out:
  - the AI conversation and sending chips as messages
  - an "All activity" page, and creating sites from the Loft
  - the jobs pill, and the phone-only Home layout (`make-loft-work-on-phones`)

## Action items

- [x] Add a `visits` table (`lastSeenAt`, `previousSeenAt`), and optional `draftChangedAt` with a `by_site_draft` index to `pages`, in `packages/backend/convex/schema.ts`.
- [x] Set `draftChangedAt` in `writeDraft` (`pages.ts`). In `publishing.ts`, clear it on publish only when the draft still matches what was published, and set it on rollback. Test a save made during a publish. Add tests in `pages.test.ts` and `publishing.test.ts`.
- [x] Export `inboxPage` and `INBOX_LIMIT` (`enquiries.ts`), and share `memberSites` (`sites.ts`) between `staff.me` and Home.
- [x] Add `packages/backend/convex/home.ts` with `markSeen` and `overview` (sites, activity, summary). Test it with `convex-test`:
  - a first visit and a new visit after 30 minutes
  - a reload within a visit
  - activity merged across two sites, newest first, capped at 4
  - enquiry grouping by form
  - only your own sites
  - no actor in rows
  - a draft waiting
- [x] Add pure `summaryLine()` and `suggestions()` in `apps/loft/src/lib/home.ts`, with tests for:
  - nothing new
  - a first visit
  - one or several published paths
  - enquiries
  - drafts waiting
  - singular and plural wording
- [x] Add `components/loft/home/`:
  - `greeting.tsx`, client-only
  - `core-input.tsx`
  - `suggestion-chips.tsx`
  - `activity-list.tsx`
  - `site-row.tsx`

  Also add `lib/flags.ts` with `CONVERSATION_ENABLED`, and a `dim` prop on `LoftView`.

- [x] Rebuild `apps/loft/src/routes/_authed/index.tsx` as Home. Its loader prefetches `home.overview`, and `markSeen` runs on mount. "All sites" in the site menu still lands here.
- [x] Run `vp check`, `vp test` and `vp run build`.
- [ ] Render Home with the built CSS over Coast at 1440px and 390px, and check the greeting and summary stay readable as text on the view. Then in local dev, publish a page, submit an enquiry, and come back after 30 minutes or with a hand-set `previousSeenAt` to see the summary and Lately update.

## Testing

- **Backend:** `convex-test` suites for `home.markSeen` (visit rotation) and `home.overview` (merge, caps, grouping, wording inputs, isolation between users), plus `draftChangedAt` across save, restore, publish and rollback.
- **Loft:** unit tests for `summaryLine()` and `suggestions()`, which hold all the wording rules.
- **Manual:** as in the last action item, including a first visit with no `previousSeenAt`, a user with no sites, and a site with no pages.

## Risks

- **"Since your last visit" feels wrong:** 30 minutes is a guess at what counts as a visit. It's one constant, so it's easy to tune.
- **Bright views behind the greeting:** text on the view relies on the spec's text shadow. Check it over Coast at both widths, and darken the dim slightly if it's not readable.
- **Users with many sites:** `overview` reads per site. That's fine at today's scale, and it's bounded by the per-site limits above.

## Decisions

- No new ADR is needed:
  - the `preferences` fields are the ones spec §12 suggests
  - `draftChangedAt` is a derived flag on an existing table, which can be dropped once AI drafts carry their own state

## Open questions

- Is 30 minutes the right gap for a new visit?
- Should "Lately" include enquiries already marked handled, as history, or only new ones? This plan shows only new ones, as spec §9's table does.
