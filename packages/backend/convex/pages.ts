import {
  draftTitle,
  MAX_PAGE_BYTES,
  pageBytes,
  parsePagePath,
} from "@workspace/core"
import { v } from "convex/values"
import { audit, ownDoc, siteMutation, siteQuery } from "./access"
import { fail } from "./errors"
import { recordDraft } from "./history"

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

export const create = siteMutation({
  args: { path: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const path = parsePagePath(args.path)
    if (!path) throw fail("invalid_path")
    const taken = await ctx.db
      .query("pages")
      .withIndex("by_site_path", (q) =>
        q.eq("siteId", ctx.site._id).eq("path", path)
      )
      .unique()
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

export const saveDraft = siteMutation({
  args: { pageId: v.id("pages"), draftHtml: v.string() },
  handler: async (ctx, { pageId, draftHtml }) => {
    const page = await ownDoc(ctx, "pages", pageId)
    if (pageBytes(draftHtml) > MAX_PAGE_BYTES) throw fail("page_too_large")

    const saved = {
      ...page,
      draftHtml,
      title: draftTitle(draftHtml) ?? page.title,
    }
    await ctx.db.patch("pages", pageId, {
      draftHtml: saved.draftHtml,
      title: saved.title,
    })
    await recordDraft(ctx, saved, { reason: "save", actor: ctx.userId })
  },
})
