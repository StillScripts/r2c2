import { TableHistory } from "@convex-dev/table-history"
import { components } from "./_generated/api"
import type { DataModel, Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"

export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000

export type DraftReason = "save" | "ai-edit" | "publish" | "restore"

/** Draft snapshots of `pages`. Beta, so only `recordDraft` and `draftHistory` touch it (SPEC §6). */
const pageHistory = new TableHistory<DataModel, "pages">(components.pageHistory)

// A snapshot can be stamped just after now when two land in the same millisecond
const LATEST = Number.MAX_SAFE_INTEGER

export type Snapshot = {
  ts: number
  reason: DraftReason
  actor: string
  draftHtml: string
}

type Attribution = Pick<Snapshot, "reason" | "actor">

async function snapshots(
  ctx: QueryCtx,
  pageId: Id<"pages">,
  maxTs: number,
  numItems: number
): Promise<Snapshot[]> {
  const { page } = await pageHistory.listDocumentHistory(ctx, pageId, maxTs, {
    numItems,
    cursor: null,
  })
  return page.flatMap(({ ts, doc, attribution }) =>
    doc
      ? [
          {
            ts,
            ...(attribution as Attribution),
            draftHtml: (doc as Doc<"pages">).draftHtml,
          },
        ]
      : []
  )
}

/** A page's snapshots, newest first. */
export const draftHistory = (
  ctx: QueryCtx,
  pageId: Id<"pages">,
  numItems = 100
) => snapshots(ctx, pageId, LATEST, numItems)

/** The page's snapshot taken at `ts`, or null. */
export async function draftAt(ctx: QueryCtx, pageId: Id<"pages">, ts: number) {
  const [snapshot] = await snapshots(ctx, pageId, ts, 1)
  return snapshot?.ts === ts ? snapshot : null
}

/**
 * Snapshot a page's draft. A save only records if the last snapshot is more than five
 * minutes old; every other reason always records.
 */
export async function recordDraft(
  ctx: MutationCtx,
  page: Doc<"pages">,
  attribution: Attribution
) {
  if (attribution.reason === "save") {
    const [last] = await draftHistory(ctx, page._id, 1)
    if (last && Date.now() - last.ts < SNAPSHOT_INTERVAL_MS) return
  }
  await pageHistory.update(ctx, page._id, page, attribution)
}
