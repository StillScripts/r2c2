---
title: T13 Add publish and rollback
depth: detailed
created: 2026-10-25
decisions:
  - docs/decisions/ADR-012-ship-elements-bundle-as-generated-module.md
---

# T13 Add publish and rollback

Turn a page's draft into a live page on the edge, and point a page back at an older
version. Publish runs T11's pipeline, assembles the finished document, writes the version,
its CSS and the live copy to R2, and only then marks the version live in Convex. Rollback
copies an older version back to the live key and repeats the "mark live" step. There's no
purge: the edge picks the change up within the 60 s `s-maxage` (ADR-011).

## Context

- **Pipeline (`@workspace/html`, T11):**
  - functions: `assignElementIds`, `checkPage` (`{ errors, warnings, forms }`),
    `sanitise` (throws `SanitiserChangedPageError`), `extractForms`, `compileCss` and
    `loadTheme`;
  - `PLATFORM_TAGS` (`["site-form"]`) marks pages that need the elements script;
  - it loads `node:fs`, so only `"use node"` actions can run it. T15's `preview` action
    already does.
- **R2 contracts (`@workspace/core`):**
  - key builders: `versionKey`, `liveKey`, `assetKey` and `elementsKey`;
  - URL prefixes: `ASSETS_PREFIX` `/assets/` and `ELEMENTS_PREFIX` `/_elements/`;
  - `LivePageMetadata` `{ pageId, hash }`, which the renderer (T06) reads from the live
    copy's R2 custom metadata to build `etag` and `cache-tag`.
- **Storage (T12):** `convex/storage.ts` has `putObject` over `@convex-dev/r2`'s `store`,
  which can't set custom metadata. The component exposes its `S3Client` (`r2.client`).
  It depends on `@aws-sdk/client-s3`.
- **Forms (T18 plan):**
  - publish adds a `sitekey` attribute to each `<site-form>`, plus a visually hidden
    honeypot `<input name="website">` that T21 checks;
  - the CSP is `style-src 'self'`, so the honeypot can't use an inline style;
  - the elements bundle (`packages/elements`, built by `vp pack`) is uploaded to
    `shared/elements/<hash>.js`, hashed with `hashContent`.
- **Data:**
  - `pageVersions` (`hash`, `cssHash`, `forms`, `publishedBy`, `publishedAt`) and
    `pages.liveVersionId` already exist;
  - the `forms` table is the per-site registry that enquiry intake checks against;
  - T11 left "a form name used on two pages must have matching fields" to T13.
- **Draft history (T15):** `recordDraft(ctx, page, { reason: "publish", actor })`
  records before a publish.
- **No UI here:** T16 adds the publish, versions and rollback UI, so T13 is backend
  only, run from the CLI.

## Approach

### Shared pieces

- **`@workspace/html` `buildRelease(draft, { theme, canonicalUrl, sitekey, elementsUrl })`:**
  an async function with no side effects. `theme` is a `Theme` from `loadTheme`. It runs
  the whole pipeline and returns
  `{ ok: false, errors, warnings } | { ok: true, draftWithIds, html, hash, css, cssHash, forms }`.
  1. `assignElementIds` on the draft. ADR-005 persists IDs, so they're written back to
     the draft. The T11 plan expected saves to assign IDs, but `@workspace/html` can't
     run in a mutation, so publish does it instead. The as-built notes record this
     divergence.
  2. `checkPage`. Any errors stop the release and come back as the result.
  3. `sanitise`.
  4. `extractForms`.
  5. Assemble the document:
     - `<!doctype html>`;
     - `<link rel="canonical">` when a canonical URL is given;
     - `<link rel="stylesheet" href="/assets/<cssHash>.css">`;
     - `<script type="module" src="<elementsUrl>">` only when the page uses a
       `PLATFORM_TAGS` element;
     - on each `<site-form>`, `sitekey="…"` and, inside its `<form>`,
       `<input name="website" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true">`.
       It goes in before the CSS compile, so the compiled CSS includes `sr-only`.
  6. `compileCss`.
  7. `hashContent` of the final document.

  Two cases are error results, not throws:
  - a page with a `<site-form>` but no `sitekey` (rule `sitekey`);
  - a form with its own field named `website`, which would clash with the honeypot
    (rule `honeypot`). All of this is unit-testable in Node without Convex.

- **Live metadata keys:** S3 sends custom metadata as `x-amz-meta-*` headers, and R2 may
  store those keys lowercased. That would break the renderer's `pageId` read.
  `LivePageMetadata` changes to the single-word keys `{ page, hash }`, which read the
  same in any case, and the renderer is updated in this PR. This is a contract change
  between T06 and T13, so both sides land together.
- **`convex/storage.ts`:** `putObject` gains an optional `metadata` argument. When
  given, it writes through `r2.client.send(new PutObjectCommand({ …, Metadata }))`;
  otherwise it keeps `r2.store`. Raw S3 writes skip the component's Convex-side
  metadata table. Nothing reads that table for these keys, and `getUrl` signs from the
  key alone. `getObjectText(ctx, key)` (via `r2.getUrl` and `fetch`)
  reads a version back for rollback.
- **Elements bundle:**
  - a new `vp run --filter @workspace/backend elements` script builds
    `packages/elements` and writes `packages/backend/elements.gen.ts`, exporting the
    minified JS as a string;
  - the file is committed;
  - CI runs the script and fails on `git diff`, so it can't go stale;
  - publish hashes the string, uploads it to `elementsKey(hash)` only if a `HeadObject`
    says it's missing, and passes `/_elements/<hash>.js` as `elementsUrl`.

### Convex

- **`convex/publish.ts`** (`"use node"`), the public action
  `publish({ siteId, pageId })`:
  1. `ctx.runQuery(internal.publishing.context, …)` loads everything, checking
     membership the same way `siteQuery` does:
     - the page (through `ownDoc`) and the site's theme;
     - the primary active domain, which gives
       `canonicalUrl = https://<host><path>`, or none;
     - the other pages' live forms.
  2. `buildRelease` with `TURNSTILE_SITE_KEY` from the environment. If it fails, the
     action returns `{ ok: false, errors, warnings }`.
  3. Form registry check: refuse with `form_conflict` when another page's live version
     defines the same form name with different fields. `fail(code, details?)` gains an
     optional details object, here `{ form }`, which the Loft can show. The check runs
     early here so that a clash stops the release before R2 is touched. `markLive`
     checks again, authoritatively.
  4. R2, in this order:
     - the CSS asset `assetKey(siteId, cssHash, "css")`;
     - the elements bundle, if needed;
     - `versionKey(siteId, hash)`;
     - `liveKey(siteId, path)` with metadata `{ page: pageId, hash }`.
  5. `ctx.runMutation(internal.publishing.markLive, …)` (below), then return
     `{ ok: true, versionId, warnings }`.
- **`convex/publishing.ts`** (default runtime):
  - **`publishContext`** and **`rollbackContext`** (internal queries), as above.
  - **`markLive`** (internal mutation), taking
    `{ pageId, draftHtml, draftWithIds, hash, cssHash, forms, actor }`:
    - calls `recordDraft` with `{ ...page, draftHtml }` (the draft publish actually
      read, not whatever is there now) and `{ reason: "publish" }`;
    - writes `draftWithIds` back only if `draftHtml` hasn't changed since publish read
      it, so an edit made mid-publish is never overwritten;
    - inserts the `pageVersions` row and sets `pages.liveVersionId`;
    - rebuilds the site's `forms` registry with `syncForms(ctx, siteId)`:
      - the registry becomes the union of the forms in every page's live version;
      - names no longer on any live page are deleted, so intake stops accepting them;
      - a clash between two live pages throws `form_conflict`, which aborts the
        mutation;
    - writes the audit entry `page.publish`.
  - **`markRolledBack`** (internal mutation): sets `liveVersionId`, runs the same
    `syncForms`, including the clash check, and writes the audit entry
    `page.rollback`.
- **`rollback({ siteId, pageId, versionId })`** (public action in `publish.ts`):
  - loads the version through `ownDoc`, and refuses with `not_found` if it belongs to
    another page;
  - checks for form clashes against the other live pages, the same way publish does;
  - reads `versionKey(siteId, hash)` from R2 and writes it to `liveKey` with the same
    metadata;
  - then `markRolledBack`.

  It doesn't touch the draft or record history, because rollback changes what's live,
  not the draft. Restoring a draft is T16.

- **Who can publish:** both owners and editors. Editors write pages, and SPEC doesn't
  limit publishing. The role check goes through the same membership load.
- **New error code:** `form_conflict`. A missing or foreign version is `not_found`, the
  same as everywhere else. An empty draft needs no code of its own, because
  `checkPage` already fails it on its title and description.
- **Env:** `TURNSTILE_SITE_KEY` joins the Convex variables in SPEC §8 and the backend
  `.env.example`. Dev uses Cloudflare's always-pass test key `1x00000000000000000000AA`.
- **Running it before T16:**
  `vp exec convex run publish:publish '{"siteId": "…", "pageId": "…"}' --identity '{"subject": "<userId>"}'`.
  The backend README documents it, along with rollback.

## Alternatives considered

- **Elements bundle uploaded by a CLI action, with its hash kept in a settings table:**
  no generated file, but it adds a table, a manual step per deploy, and a way for
  publish to point at a script that was never uploaded.
- **Bundling the elements source into Convex with a `?raw` import:** Convex's bundler
  doesn't support it.
- **Keeping `pageId` in the metadata and hoping R2 keeps the case:** one silent bug away
  from every page losing its per-page cache tag. Single-word keys remove the question.
- **Copying the version object to the live key with S3 `CopyObject`:** saves an upload,
  but needs `MetadataDirective: REPLACE` and a second code path. The pages are small,
  so `PutObject` is used for both.
- **A minimal Publish button in the editor:** handy for testing, but T16 owns that UI.
  The CLI covers T13's "done when".

## Scope

- In:
  - `buildRelease` and document assembly in `@workspace/html`;
  - the metadata key change in core and the renderer;
  - `putObject` metadata and `getObjectText`;
  - the elements bundle script, the generated file and the CI check;
  - the `publish` and `rollback` actions, and the `publishing` query and mutations;
  - the form registry check, error codes, env docs, tests and README.
- Out:
  - the Loft UI (T16);
  - unpublishing and deleting live pages;
  - site 404 pages;
  - purge (ADR-011);
  - drafts with shared parts or collections;
  - the gateway forms route (T21).

## Action items

- [x] Add `buildRelease` and document assembly to `packages/html`, with unit tests
      (below).
- [x] Change `LivePageMetadata` to `{ page, hash }` in core and the renderer, and update
      the renderer tests.
- [x] Pin `@aws-sdk/client-s3` to the version `@convex-dev/r2` resolves, and add it to
      the backend. Extend `putObject` with metadata and add `getObjectText`.
- [x] Add the `elements` script, `packages/backend/elements.gen.ts`, and the CI step
      that fails on a stale bundle.
- [x] Add `convex/publishing.ts` (`context`, `markLive`, `markRolledBack`,
      `syncForms`), `form_conflict`, and `fail(code, details?)`.
- [x] Add `convex/publish.ts` (`publish`, `rollback`) and `TURNSTILE_SITE_KEY` handling.
- [x] Add `convex-test` suites for `publishing.ts` (below).
- [x] Update SPEC §8, the backend `.env.example` and the README (env, CLI publish and
      rollback).
- [x] Run `vp check`, `vp test` and `vp run build`.

## Testing

**`packages/html` unit tests (`release.test.ts`):**

- **A clean page:**
  - doctype, canonical, CSS link and hash all present;
  - the hash is stable across runs;
  - the hash changes when the CSS or the canonical URL changes.
- **IDs:** a draft without IDs comes back as `draftWithIds` with `data-r2c2-id`s, and
  the published HTML carries the same IDs.
- **A page with `<site-form>`:**
  - the script tag, `sitekey` and honeypot inside the form are present;
  - `sr-only` is in the CSS;
  - a missing sitekey is an error result;
  - a form with its own `website` field is an error result.
- **A page without platform tags:** no script tag.
- **House-rule errors:** return `ok: false` with the errors and no HTML.

**`convex-test` (`publishing.test.ts`):**

- **`markLive`:**
  - inserts the version and sets `liveVersionId`;
  - registers the forms and writes the `page.publish` audit entry;
  - records one `publish` snapshot, even straight after a save.
- **`markLive` with a draft edited mid-publish:** the draft isn't overwritten, but the
  version still goes live.
- **`context`:**
  - refuses outsiders and signed-out callers;
  - returns the primary domain's canonical URL, and none without a primary;
  - returns other pages' live forms.
- **`syncForms`:**
  - a form with the same name and different fields on two live pages is refused;
  - identical fields are allowed;
  - a form no longer on any live page is removed from the registry.
- **`markRolledBack`:**
  - points `liveVersionId` at the older version, resyncs the forms and writes the audit
    entry;
  - refuses a version from another page;
  - refuses a rollback that would clash with another page's live form.

**Manual, on dev with the local edge** (the task's "done when"; this session can't
reach Convex or R2):

- publish the seed page from the CLI, `curl` it through `wrangler dev` after 60 s, and
  see the new HTML with `etag` = hash and the CSS loading;
- publish again, roll back to the first version, and see the old page after the cache
  expires.

## As built

- The generated bundle is `packages/backend/elements.gen.ts`, outside `convex/` so Convex
  doesn't treat it as a function module, and matching `*.gen.ts` so the formatter
  skips it. The script lives in `packages/backend/scripts/` with its own Node
  tsconfig.
- `buildRelease` takes a `cssUrl(cssHash)` option alongside `elementsUrl`, so the URL
  shape stays in the backend next to the key builders.
- Publish uploads the elements script only when the finished page actually references
  it.
- `markLive` reuses an existing version row when the same hash is published again.
- `putObject` always writes straight to S3, with or without metadata. The component's
  `store` refuses to rewrite a key it already tracks, which republishing an unchanged
  CSS file does, so publish never goes through it.
- Publish writes the elements script, CSS and version in parallel, then the live copy
  last, so the edge never serves a page whose files aren't in R2 yet.
- `buildRelease` parses the sanitised page once, reuses `checkPage`'s forms, and
  returns `usesElements`, which decides whether the script is uploaded.
- The context query is split into `publishContext` and `rollbackContext`. The second
  always returns its version, and both skip a live version that has gone missing.
- `loadSite` from `access.ts` is exported for the internal `publishing.context` query,
  which runs as the caller because Convex forwards the identity through
  `ctx.runQuery`.
- `publish.test.ts` runs both actions in `convex-test` with `./storage` mocked, which
  covers the write order, the live metadata, the elements upload and rollback. Only
  real R2 and the edge are left for the manual check.

## Risks

- **No Convex or R2 in the agent session.** The actions can't be run end to end here.
  Mitigation: keep them thin, with the logic in `buildRelease` and the mutations, which
  are tested, and list the manual check in the PR.
- **S3 metadata casing and headers on R2.** Mitigation: single-word keys. The manual
  check confirms the renderer sees them (`etag` equals the hash).
- **A stale elements bundle.** Mitigation: the CI diff check.
- **A form clash that only `markLive` catches** (two pages publishing at the same time):
  the live key is already written, so the edge briefly serves a page whose form intake
  will reject. Mitigation: the early check in the action makes this a race between
  simultaneous publishes only. Republishing either page after fixing the form settles
  it.
- **Partial failure** (R2 written, then `markLive` fails). Nothing goes live in Convex,
  but the live key already has the new HTML, so the edge serves it while Convex still
  points at the old version. Mitigation: `markLive` is a small mutation that rarely
  fails, and publish can be rerun safely (same hash, same keys). The PR notes this, and
  a fix (writing the live key last, after `markLive`) would break SPEC's "R2 before
  live" rule, so it stays as is.

## Decisions

- [ADR-012](../decisions/ADR-012-ship-elements-bundle-as-generated-module.md): the
  elements bundle ships as a generated module committed to the backend and checked in
  CI.
- The `LivePageMetadata` key change follows T06's plan, which made the type the
  contract. No ADR, but the PR calls it out.

## Settled

- Editors and owners can both publish.
- The elements bundle ships as a generated module committed to the backend (approach A),
  recorded in ADR-012.
