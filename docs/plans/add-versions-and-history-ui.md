---
title: T16 Add publish, versions, rollback and draft history UI
depth: simple
created: 2026-10-25
---

# T16 Add publish, versions, rollback and draft history UI

Put T13's publish and rollback and T15's draft history in the Loft. The editor gets a
Publish button. A new History page per page lists published versions (with rollback)
and draft snapshots (with preview and restore). The backend adds the read queries and
the restore mutation the UI needs.

## Scope

- In:
  - **Backend:**
    - `pages:versions`: published versions, newest first, each with time, author name
      and whether it's live;
    - `pages:history`: draft snapshots with time, author name and reason, plus each
      snapshot's draft so it can be previewed;
    - `pages:restoreDraft`: first records the current draft as a `restore` snapshot, so
      the restore can be undone, then writes the old snapshot back as the draft and
      audits `page.restore`.

    Author names come from Better Auth (`authComponent.getAnyUserById`), and `system`
    shows as "System".

  - **Editor:**
    - a Publish button that saves unsaved changes first and asks for confirmation in a
      Base UI alert dialog;
    - on failure, the house-rule errors show in the existing issues list;
    - on success, a "Published" note;
    - a link to History.
  - **History route** at `/sites/$siteId/pages/$pageId/history`, not nested inside the
    editor:
    - versions, each with Rollback (confirmed);
    - snapshots, each with Preview, which shows it in the same sandboxed iframe with
      compiled CSS, and Restore (confirmed);
    - restoring returns to the editor with the restored draft.
  - **`@workspace/ui`:** a hand-written `AlertDialog` on `@base-ui/react/alert-dialog`
    in the `base-rhea` style. The shadcn registry is blocked in the agent session.
  - **Tests and docs:** `convex-test` for the new queries and `restoreDraft`, and the
    Loft README.
- Out:
  - previewing a published version: its HTML is in R2 and needs a signed read, so the
    list shows the time, author and live badge only;
  - diffs between snapshots;
  - unpublishing;
  - the per-page publish lock (`add-publish-page-lock`).

## Action items

- [x] Add `pages:versions`, `pages:history` and `pages:restoreDraft` to
      `packages/backend/convex/pages.ts`, using `draftHistory` and `recordDraft`, with a
      `memberNames` helper for author names.
- [x] Add `convex-test` cases:
  - versions are sorted newest first, with the live one marked;
  - history includes the reason and author;
  - `restoreDraft` writes the snapshot back and records a `restore` snapshot of the
    previous draft, which can itself be restored;
  - a snapshot from another page and an outsider are both refused.
- [x] Add `AlertDialog` to `packages/ui`.
- [x] Add Publish to the editor: save if unsaved, confirm, call `publish:publish`, then
      show the errors or "Published", with the History link.
- [x] Add the History route with versions and rollback, snapshots and preview, and
      restore.
- [x] Update `apps/loft/README.md`.
- [x] Run `vp check`, `vp test` and `vp run build`.

## As built

- Confirmations go through one `ConfirmButton` in `apps/loft/src/components/`, built on
  the new `AlertDialog`.
- The editor's preview hook, frame and issues list moved to
  `apps/loft/src/components/page-preview.tsx`, so the History page previews snapshots
  the same way.
- The History route is `pages/$pageId_.history.tsx`, so it isn't nested inside the
  editor's route.
- History lists the newest 100 snapshots, the page size of `draftHistory`.
- Clicking through the UI needs a Convex deployment, which the agent session can't
  reach, so it's checked by `vp check`, the build and the backend tests only.

## Open questions

- Should rollback and restore be open to editors as well as owners? Assumed yes, the
  same as publish.
