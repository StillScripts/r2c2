import {
  draftTitle,
  MAX_PAGE_BYTES,
  pageBytes,
  parsePagePath,
} from "@workspace/core"
import { v } from "convex/values"
import { audit, ownDoc, siteMutation, siteQuery } from "./access"
import type { Doc, Id } from "./_generated/dataModel"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { authComponent } from "./auth"
import { fail } from "./errors"
import { draftAt, draftHistory, recordDraft } from "./history"
import { assertUnclaimed } from "./publishing"

const escapeText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const starterDraft = (title: string) => `<html lang="en">
  <head>
    <title>${escapeText(title)}</title>
    <meta name="description" content="" />
  </head>
  <body>
    <main class="mx-auto max-w-3xl p-6">
      <h1>${escapeText(title)}</h1>
    </main>
  </body>
</html>
`

export const get = siteQuery({
  args: { pageId: v.id("pages") },
  handler: (ctx, { pageId }) => ownDoc(ctx, "pages", pageId),
})

export const list = siteQuery({
  args: {},
  handler: async (ctx) => {
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_site_path", (q) => q.eq("siteId", ctx.site._id))
      .collect()
    return pages.map(({ _id, path, title, liveVersionId }) => ({
      _id,
      path,
      title,
      isLive: liveVersionId !== undefined,
    }))
  },
})

/** The site's page at `rawPath` once it's normalised, or null if there's none yet. */
export async function pageAt(
  ctx: QueryCtx,
  siteId: Id<"sites">,
  rawPath: string
) {
  const path = parsePagePath(rawPath)
  if (!path) throw fail("invalid_path")
  const page = await ctx.db
    .query("pages")
    .withIndex("by_site_path", (q) => q.eq("siteId", siteId).eq("path", path))
    .unique()
  return { path, page }
}

export const create = siteMutation({
  args: { path: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const { path, page: taken } = await pageAt(ctx, ctx.site._id, args.path)
    if (taken) throw fail("path_taken")

    const title = args.title.trim() || path
    const pageId = await ctx.db.insert("pages", {
      siteId: ctx.site._id,
      path,
      title,
      draftHtml: starterDraft(title),
    })
    await audit(ctx, { action: "page.create", target: path })
    return pageId
  },
})

/** Check a new draft and patch it in, keeping `title` in step with its `<title>`. */
export async function writeDraft(
  ctx: MutationCtx,
  page: Doc<"pages">,
  draftHtml: string
) {
  if (pageBytes(draftHtml) > MAX_PAGE_BYTES) throw fail("page_too_large")
  const patch = { draftHtml, title: draftTitle(draftHtml) ?? page.title }
  await ctx.db.patch("pages", page._id, patch)
  return { ...page, ...patch }
}

export const saveDraft = siteMutation({
  args: { pageId: v.id("pages"), draftHtml: v.string() },
  handler: async (ctx, { pageId, draftHtml }) => {
    const page = await ownDoc(ctx, "pages", pageId)
    await assertUnclaimed(ctx, pageId)
    const saved = await writeDraft(ctx, page, draftHtml)
    await recordDraft(ctx, saved, { reason: "save", actor: ctx.userId })
  },
})

/** A lookup from actor IDs, as stored in versions, snapshots and `auditLog`, to display names. */
async function actorNames(ctx: QueryCtx, actors: string[]) {
  const names = new Map(
    await Promise.all(
      [...new Set(actors)].map(
        async (actor) =>
          [
            actor,
            actor === "system"
              ? "System"
              : ((await authComponent.getAnyUserById(ctx, actor))?.name ??
                "Former member"),
          ] as const
      )
    )
  )
  return (actor: string) => names.get(actor) ?? "Former member"
}

/** The page's published versions, newest first. */
export const versions = siteQuery({
  args: { pageId: v.id("pages") },
  handler: async (ctx, { pageId }) => {
    await ownDoc(ctx, "pages", pageId)
    const versions = await ctx.db
      .query("pageVersions")
      .withIndex("by_page_published", (q) => q.eq("pageId", pageId))
      .order("desc")
      .take(100)
    const nameOf = await actorNames(
      ctx,
      versions.map((v) => v.publishedBy)
    )
    return versions.map(({ _id, publishedAt, publishedBy }) => ({
      _id,
      publishedAt,
      publishedBy: nameOf(publishedBy),
    }))
  },
})

/** The page's draft snapshots, newest first, without their drafts. */
export const history = siteQuery({
  args: { pageId: v.id("pages") },
  handler: async (ctx, { pageId }) => {
    await ownDoc(ctx, "pages", pageId)
    const snapshots = await draftHistory(ctx, pageId)
    const nameOf = await actorNames(
      ctx,
      snapshots.map((s) => s.actor)
    )
    return snapshots.map(({ ts, reason, actor }) => ({
      ts,
      reason,
      author: nameOf(actor),
    }))
  },
})

/** One snapshot's draft, for previewing. */
export const snapshot = siteQuery({
  args: { pageId: v.id("pages"), ts: v.number() },
  handler: async (ctx, { pageId, ts }) => {
    await ownDoc(ctx, "pages", pageId)
    const snapshot = await draftAt(ctx, pageId, ts)
    if (!snapshot) throw fail("not_found")
    return snapshot.draftHtml
  },
})

/**
 * Put an earlier snapshot back as the draft. The current draft is recorded first, so
 * the restore can itself be undone (SPEC §6).
 */
export const restoreDraft = siteMutation({
  args: { pageId: v.id("pages"), ts: v.number() },
  handler: async (ctx, { pageId, ts }) => {
    const page = await ownDoc(ctx, "pages", pageId)
    await assertUnclaimed(ctx, pageId)
    const snapshot = await draftAt(ctx, pageId, ts)
    if (!snapshot) throw fail("not_found")

    await recordDraft(ctx, page, { reason: "restore", actor: ctx.userId })
    await writeDraft(ctx, page, snapshot.draftHtml)
    await audit(ctx, { action: "page.restore", target: page.path })
  },
})
