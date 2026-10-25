import {
  draftTitle,
  MAX_PAGE_BYTES,
  pageBytes,
  parsePagePath,
} from "@workspace/core"
import { v } from "convex/values"
import { audit, ownDoc, siteMutation, siteQuery } from "./access"
import type { QueryCtx } from "./_generated/server"
import { authComponent } from "./auth"
import { fail } from "./errors"
import { draftHistory, recordDraft } from "./history"

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

    const patch = { draftHtml, title: draftTitle(draftHtml) ?? page.title }
    await ctx.db.patch("pages", pageId, patch)
    await recordDraft(
      ctx,
      { ...page, ...patch },
      { reason: "save", actor: ctx.userId }
    )
  },
})

/** Display names for actors, as stored in `auditLog`, versions and snapshots. */
async function actorNames(ctx: QueryCtx, actors: string[]) {
  const names = new Map<string, string>()
  await Promise.all(
    [...new Set(actors)].map(async (actor) => {
      const user =
        actor === "system"
          ? null
          : await authComponent.getAnyUserById(ctx, actor)
      names.set(
        actor,
        actor === "system" ? "System" : (user?.name ?? "Former member")
      )
    })
  )
  return names
}

/** The page's published versions, newest first. */
export const versions = siteQuery({
  args: { pageId: v.id("pages") },
  handler: async (ctx, { pageId }) => {
    const page = await ownDoc(ctx, "pages", pageId)
    const versions = await ctx.db
      .query("pageVersions")
      .withIndex("by_page_hash", (q) => q.eq("pageId", pageId))
      .collect()
    const names = await actorNames(
      ctx,
      versions.map((v) => v.publishedBy)
    )
    return versions
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .map(({ _id, publishedAt, publishedBy }) => ({
        _id,
        publishedAt,
        publishedBy: names.get(publishedBy)!,
        isLive: _id === page.liveVersionId,
      }))
  },
})

/** The page's draft snapshots, newest first, with each draft for previewing. */
export const history = siteQuery({
  args: { pageId: v.id("pages") },
  handler: async (ctx, { pageId }) => {
    await ownDoc(ctx, "pages", pageId)
    const { page: snapshots } = await draftHistory(ctx, pageId)
    const names = await actorNames(
      ctx,
      snapshots.map((s) => s.attribution.actor)
    )
    return snapshots.map(({ ts, doc, attribution }) => ({
      ts,
      reason: attribution.reason as string,
      author: names.get(attribution.actor)!,
      draftHtml: (doc as { draftHtml: string }).draftHtml,
    }))
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
    const { page: snapshots } = await draftHistory(ctx, pageId)
    const snapshot = snapshots.find((s) => s.ts === ts)
    if (!snapshot) throw fail("not_found")

    const { draftHtml } = snapshot.doc as { draftHtml: string }
    await recordDraft(ctx, page, { reason: "restore", actor: ctx.userId })
    await ctx.db.patch("pages", pageId, {
      draftHtml,
      title: draftTitle(draftHtml) ?? page.title,
    })
    await audit(ctx, { action: "page.restore", target: page.path })
  },
})
