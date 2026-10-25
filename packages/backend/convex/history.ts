import { TableHistory } from "@convex-dev/table-history"
import { components } from "./_generated/api"
import type { DataModel, Doc } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000

export type DraftReason = "save" | "ai-edit" | "publish" | "restore"

/** Draft snapshots of `pages`. Beta, so only `recordDraft` and `draftHistory` touch it (SPEC §6). */
const pageHistory = new TableHistory<DataModel, "pages">(components.pageHistory)

// A snapshot can be stamped just after now when two land in the same millisecond
const LATEST = Number.MAX_SAFE_INTEGER

/** A page's snapshots, newest first. */
export const draftHistory = (
  ctx: QueryCtx,
  page: Doc<"pages">,
  numItems = 100
) =>
  pageHistory.listDocumentHistory(ctx, page._id, LATEST, {
    numItems,
    cursor: null,
  })

/**
 * Snapshot a page's draft. A save only records if the last snapshot is more than five
 * minutes old; every other reason always records.
 */
export async function recordDraft(
  ctx: MutationCtx,
  page: Doc<"pages">,
  attribution: { reason: DraftReason; actor: string }
) {
  if (attribution.reason === "save") {
    const {
      page: [last],
    } = await draftHistory(ctx, page, 1)
    if (last && Date.now() - last.ts < SNAPSHOT_INTERVAL_MS) return false
  }
  await pageHistory.update(ctx, page._id, page, attribution)
  return true
}
