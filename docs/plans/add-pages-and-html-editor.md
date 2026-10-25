---
title: T15 Add pages and the HTML editor
depth: detailed
created: 2026-10-25
---

# T15 Add pages and the HTML editor

Let staff list a site's pages, create one, and edit its HTML source with a live preview,
all without publishing. Saving writes `pages.draftHtml`. Snapshots go to
`@convex-dev/table-history` (as `pageHistory`), only through one `recordDraft()` helper,
following SPEC §6's rules on when to record.

## Context

- **Backend today:** `pages` already exists (`siteId`, `path`, `title`, `draftHtml`,
  `liveVersionId`, index `by_site_path`). `convex/pages.ts` has only `get`. Site access
  goes through `siteQuery`/`siteMutation` and `ownDoc` (`convex/access.ts`), and
  `sites:get` returns the site, including its `theme` CSS.
- **HTML pipeline:** `@workspace/html` (T11) has `loadTheme`, `compileCss(html, theme)`
  and `checkPage(html, theme)`, which returns `{ errors, warnings, forms }` of `Issue`s
  with line and column. It
  imports `node:fs`, `node:module` and `path`, so it can only run in a Convex
  `"use node"` action, and nothing has run it inside Convex yet. A page's `<title>` and
  `<meta name="description">` live in `draftHtml` (T11 plan).
- **Loft (T14):** has sign-in, an `_authed` layout and `/` listing the user's sites from
  `staff:me`. It has `Button`, `Input` and `Label` in `@workspace/ui`.
- **SPEC §6 draft history:**
  - record a snapshot when an AI edit is applied, before a publish, before a restore,
    and on a manual save if the last snapshot is more than five minutes old;
  - never record on every keystroke;
  - the component is in beta, so it's called only through `recordDraft()`.
- **The component:** `@convex-dev/table-history` 0.1.6 (pinned in SPEC §2) exposes
  `new TableHistory(components.pageHistory)` with `update(ctx, id, doc, attribution)`
  and `listDocumentHistory(ctx, id, maxTs, paginationOpts)`, newest first. It has no
  `/test` export, so `convex-test` registers it by hand from its component schema and
  modules.
- **Open clean-up:** `clean-up-convex-schema` notes that `pages.title` duplicates the
  draft's `<title>`.

## Approach

**Backend: `convex/history.ts`**

- `pageHistory = new TableHistory<DataModel, "pages">(components.pageHistory)`.
- `recordDraft(ctx, page, { reason, actor })` takes `reason` as
  `"save" | "ai-edit" | "publish" | "restore"` and `actor` as the member's user ID (or
  `"system"`, as in `auditLog`), and stores both as the attribution.
  - For `"save"`, it first reads the newest entry with `listDocumentHistory`, numItems 1.
    If that entry is under five minutes old (`SNAPSHOT_INTERVAL_MS`), it returns without
    recording. The five minutes count from the last snapshot of any kind, so a save just
    after a publish snapshot is skipped too.
  - Every other reason always records.
  - It's the only module that imports the component. T15 only calls it with `"save"`;
    the other reasons are typed now for T13, T16 and AI editing.

**Backend: `convex/pages.ts`**

- `list` (`siteQuery`): the site's pages through the `by_site_path` prefix, returning
  `_id`, `path`, `title` and whether each has a live version. Sorted by path.
- `create` (`siteMutation`, editors allowed), taking `{ path, title }`:
  - normalises and validates the path with a `parsePagePath` helper in `@workspace/core`.
    It builds on the existing `normalisePath` (decode, lowercase, no `..`) and also
    requires `/` or kebab-case segments (`[a-z0-9]+(-[a-z0-9]+)*`), with at most 200
    characters;
  - fails with new `ErrorCode`s `invalid_path` and `path_taken`, following the domain
    codes (`invalid_hostname`, `hostname_taken`);
  - inserts a starter `draftHtml` with the title in `<title>`, an empty description
    meta and a simple `<main>`;
  - writes the audit entry `page.create`, and returns the ID. It records no snapshot:
    SPEC §6 doesn't list creation.
- `saveDraft` (`siteMutation`), taking `{ pageId, draftHtml }`:
  - loads the page through `ownDoc` and refuses HTML over `MAX_PAGE_BYTES` (500 KB)
    with a new `page_too_large` code. `MAX_PAGE_BYTES` moves from `@workspace/html` to
    `@workspace/core` for the same reason, and `check.ts` imports it from there;
  - patches `draftHtml`, and `title` from the draft's `<title>` when it has one, so the
    list label follows the page. It reads the title with a small `draftTitle(html)`
    regex helper in `@workspace/core`, not `@workspace/html`, because that package
    loads `node:fs` through `theme.ts` and can't run in a mutation;
  - calls `recordDraft(ctx, page, { reason: "save", actor: ctx.userId })`. It writes no audit entry, since saves are
    frequent and publish is what gets audited.
- `get` stays as it is.

**Backend: `convex/preview.ts`** (`"use node"`)

- The public action `preview`, taking `{ siteId, html }`:
  - loads the site through `ctx.runQuery(api.sites.get, { siteId })`, so the caller's
    membership is checked the same way as everywhere else;
  - runs `loadTheme(site.theme)`, then `compileCss` and `checkPage` in parallel;
  - returns `{ css, errors, warnings }`.
- `convex.json` lists `tailwindcss` (and `@workspace/html` if needed) under
  `node.externalPackages`, so `require.resolve("tailwindcss/index.css")` finds the file
  at runtime.

**Loft: routes under `_authed`**

- Editors and owners can both create and save pages. Neither mutation passes
  `role: "owner"`.
- `/sites/$siteId`: the site's name from `sites:get`, the page list (path, title, a "Live" badge if published) and a
  small "New page" form (path, title). On create, it navigates to the editor. The
  sites on `/` link here.
- `/sites/$siteId/pages/$pageId`: the editor.
  - **Left:** a monospace `<textarea>` holding the draft.
  - **Right:** an `<iframe sandbox="" srcdoc=…>`, with no scripts and no same-origin
    access. It shows the draft, with the compiled CSS injected as a `<style>` in
    `<head>`.
  - **Preview:** the editor calls `preview` 400 ms after typing stops, and ignores
    out-of-order responses. House-rule errors and warnings show under the editor as
    `Line N: message`, with errors in the destructive colour and warnings muted.
  - **Saving:** the Save button (and ⌘/Ctrl+S) calls `saveDraft`. It shows "Unsaved
    changes" while the text differs from the stored draft, and warns before leaving
    with unsaved edits. Saving is manual, with no autosave, which matches SPEC §6's
    "manual save".
- **Helpers in `apps/loft/src/lib/`, unit tested:**
  - `previewDocument(html, css)`, which puts a `<style>` into the draft's head (or
    wraps a fragment);
  - a tiny `debounce`-style hook, unless an existing one fits.

## Alternatives considered

- **CodeMirror instead of a `<textarea>`:** gives highlighting and line numbers, but adds
  a dependency and an ADR. Conversation-first and AI editing are coming, so a plain
  editor is enough until then.
- **Compiling Tailwind in the browser:** no round trip, but the preview CSS could then
  differ from publish CSS, and the browser would need Tailwind's stylesheet. One
  compile path in Convex keeps the preview honest.
- **Autosave:** smoother, but a snapshot per pause would go against SPEC §6. It could
  come later and record only on explicit saves.
- **A history trigger on every `pages` write:** records too often, against SPEC §6.

## Scope

- In:
  - `@convex-dev/table-history` pin and `pageHistory` install;
  - `history.ts`, the `pages` functions, the `preview` action and `convex.json`;
  - `parsePagePath`, `draftTitle` and `MAX_PAGE_BYTES` in `@workspace/core`;
  - the two Loft routes and the editor;
  - tests, and README notes.
- Out:
  - publish, rollback, versions and the history UI (T13, T16);
  - AI editing, deleting or renaming pages, and changing a page's path;
  - CodeMirror;
  - the wider schema clean-up (`clean-up-convex-schema`), except keeping `title` in
    step with `<title>` on save.

## Action items

- [x] Pin `@convex-dev/table-history` 0.1.6 in the catalog and add it to
      `packages/backend`. Register `app.use(tableHistory, { name: "pageHistory" })`, and
      register it in `test/setup.ts` from the component's schema and modules.
- [x] Add `parsePagePath` and `draftTitle` to `packages/core`, and move `MAX_PAGE_BYTES`
      there, with tests.
- [x] Add `convex/history.ts` with `recordDraft`.
- [x] Add `pages:list`, `pages:create` and `pages:saveDraft`.
- [x] Add the `preview` action in `convex/preview.ts` and `convex.json` external
      packages. Prove the compile runs in Convex's Node runtime, or record the
      workaround.
- [x] Add Loft `/sites/$siteId` (list and create), and link sites from `/`.
- [x] Add the editor route: textarea, debounced preview, sandboxed iframe, issues list,
      Save with ⌘/Ctrl+S, and an unsaved-changes guard.
- [x] Add `previewDocument` with unit tests.
- [x] Update the backend and Loft READMEs.
- [x] Run `vp check`, `vp test` and `vp run build`. (Checking the editor in `vp dev`
      wasn't possible: it needs a signed-in Convex session, and the agent session
      can't reach a Convex deployment or download a local backend.)

## Testing

**`convex-test` (`pages.test.ts`, `history.test.ts`):**

- `create`:
  - makes a page with a starter draft and an audit entry;
  - refuses a duplicate path and a bad path;
  - refuses an outsider with `not_found`, and signed-out callers.
- `list` returns only that site's pages, sorted.
- `saveDraft`:
  - updates `draftHtml` and `title`;
  - refuses a page from another site with `not_found`, and oversized HTML.
- **Snapshots:**
  - the first save records one snapshot;
  - a second save within five minutes records none;
  - a save more than five minutes later records one (fake timers);
  - `recordDraft` with `"publish"` or `"restore"` records even within five minutes;
  - `create` records none.

**Other tests:**

- `vp test` units for `parsePagePath`, `draftTitle` and `previewDocument`, including a fragment with no
  `<head>`.
- The `preview` action is covered by `@workspace/html`'s own tests for the compile. A
  `convex-test` call checks that it refuses an outsider.

**Manual on a real dev deployment** (for the reviewer):

- create a page, edit it and see the preview restyle;
- see a house-rule issue for a bad class;
- save, reload, and see the draft kept.

## As built

- `history.ts` also exports `draftHistory(ctx, page, numItems)`, which `recordDraft` and
  the tests use to read a page's snapshots, so nothing else imports the component. It
  reads with no upper time bound: when two snapshots land in the same millisecond, the
  component stamps the second one 1 ms ahead.
- `convex-test` registers the component from its `dist/esm/component` files, and
  `vite.config.ts` inlines `@convex-dev/table-history`, because its published ESM uses
  imports without extensions.
- `convex codegen` needs a deployment, so `_generated/api.d.ts` was updated by hand
  (the `history` and `preview` modules, and the `pageHistory` component). The next
  `convex dev` regenerates it.
- `preview` returns an explicit type, because its `api.sites.get` call would otherwise
  make its return type circular.

## Risks

- **Tailwind compile in Convex's Node runtime:** `require.resolve` of the stylesheet may
  fail once the action is bundled. Mitigation: `externalPackages`. Failing that, pass
  the stylesheet through `loadStylesheet` from an import of `tailwindcss/index.css?raw`,
  which needs a small change to `@workspace/html`. This can't be checked without a
  Convex deployment, so it's listed as a manual check.
- **Cold-start latency** for the `preview` action (one to two seconds for Node actions)
  makes the first preview slow. Mitigation: `loadTheme` caches per instance, and the
  iframe shows the unstyled HTML at once, then the CSS when it arrives.
- **`table-history` in beta:** it's only reached through `recordDraft`. If
  `convex-test` registration is awkward, the history tests check its `update` calls
  through the helper instead.

## Decisions

- No new ADR. The libraries are pinned in SPEC §2, and the record-on-save rule is SPEC
  §6's. The plain `<textarea>` editor is a deliberate stopgap, and a later move to
  CodeMirror would get its own ADR.

## Open questions

- Should `title` track the draft's `<title>` on save? This plan assumes yes, which
  settles that point of `clean-up-convex-schema` early.
