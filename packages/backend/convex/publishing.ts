import type { FormDefinition } from "@workspace/html"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { loadSite, writeAudit } from "./access"
import { fail } from "./errors"
import { recordDraft } from "./history"
import { formDefinition } from "./validators"

const sameFields = (a: FormDefinition, b: FormDefinition) => {
  const key = (form: FormDefinition) =>
    JSON.stringify(
      [...form.fields].sort((x, y) => x.name.localeCompare(y.name))
    )
  return key(a) === key(b)
}

/** The name of the first form defined differently in `forms` and `others`, if any. */
export function formClash(forms: FormDefinition[], others: FormDefinition[]) {
  return forms.find((form) =>
    others.some((other) => other.name === form.name && !sameFields(form, other))
  )?.name
}

async function livePages(ctx: QueryCtx, siteId: Id<"sites">) {
  const pages = await ctx.db
    .query("pages")
    .withIndex("by_site_path", (q) => q.eq("siteId", siteId))
    .collect()
  return Promise.all(
    pages.flatMap(({ _id, liveVersionId }) =>
      liveVersionId
        ? [
            ctx.db
              .get("pageVersions", liveVersionId)
              .then((version) => ({ pageId: _id, version: version! })),
          ]
        : []
    )
  )
}

/**
 * Rebuild the site's form registry from its live versions, so enquiry intake only
 * accepts forms that are on a live page. Two live pages defining one form differently
 * is refused.
 */
export async function syncForms(ctx: MutationCtx, siteId: Id<"sites">) {
  const live = new Map<string, FormDefinition>()
  for (const { version } of await livePages(ctx, siteId)) {
    for (const form of version.forms) {
      const existing = live.get(form.name)
      if (existing && !sameFields(existing, form)) {
        throw fail("form_conflict", { form: form.name })
      }
      live.set(form.name, form)
    }
  }

  const registry = await ctx.db
    .query("forms")
    .withIndex("by_site_name", (q) => q.eq("siteId", siteId))
    .collect()
  for (const entry of registry) {
    const form = live.get(entry.name)
    if (!form) await ctx.db.delete("forms", entry._id)
    else if (!sameFields(entry, form)) {
      await ctx.db.patch("forms", entry._id, { fields: form.fields })
    }
    live.delete(entry.name)
  }
  for (const form of live.values()) {
    await ctx.db.insert("forms", { siteId, ...form })
  }
}

async function ownPage(
  ctx: QueryCtx,
  siteId: Id<"sites">,
  pageId: Id<"pages">
) {
  const page = await ctx.db.get("pages", pageId)
  if (!page || page.siteId !== siteId) throw fail("not_found")
  return page
}

/** Everything publish and rollback need, loaded as the signed-in member. */
export const context = internalQuery({
  args: {
    siteId: v.id("sites"),
    pageId: v.id("pages"),
    versionId: v.optional(v.id("pageVersions")),
  },
  handler: async (ctx, { siteId, pageId, versionId }) => {
    const { site, userId } = await loadSite(ctx, siteId)
    const page = await ownPage(ctx, siteId, pageId)
    let version: Doc<"pageVersions"> | null = null
    if (versionId) {
      version = await ctx.db.get("pageVersions", versionId)
      if (!version || version.pageId !== pageId) throw fail("not_found")
    }
    const primary = await ctx.db
      .query("domains")
      .withIndex("by_site", (q) => q.eq("siteId", siteId))
      .filter((q) =>
        q.and(
          q.eq(q.field("kind"), "primary"),
          q.eq(q.field("status"), "active")
        )
      )
      .first()
    const otherForms = (await livePages(ctx, siteId))
      .filter((live) => live.pageId !== pageId)
      .flatMap((live) => live.version.forms)

    return {
      userId,
      theme: site.theme,
      page,
      version,
      canonicalUrl: primary
        ? `https://${primary.hostname}${page.path}`
        : undefined,
      otherForms,
    }
  },
})

/** Record a published release once R2 holds it, and point the page at it. */
export const markLive = internalMutation({
  args: {
    siteId: v.id("sites"),
    pageId: v.id("pages"),
    actor: v.string(),
    // The draft publish read, and the same draft with element IDs added
    draftHtml: v.string(),
    draftWithIds: v.string(),
    hash: v.string(),
    cssHash: v.string(),
    forms: v.array(formDefinition),
  },
  handler: async (
    ctx,
    { siteId, pageId, actor, draftHtml, draftWithIds, ...release }
  ) => {
    const page = await ownPage(ctx, siteId, pageId)
    await recordDraft(ctx, { ...page, draftHtml }, { reason: "publish", actor })
    // An edit saved while publish ran wins over the IDs
    if (page.draftHtml === draftHtml && draftWithIds !== draftHtml) {
      await ctx.db.patch("pages", pageId, { draftHtml: draftWithIds })
    }

    const existing = await ctx.db
      .query("pageVersions")
      .withIndex("by_page", (q) => q.eq("pageId", pageId))
      .filter((q) => q.eq(q.field("hash"), release.hash))
      .first()
    const versionId =
      existing?._id ??
      (await ctx.db.insert("pageVersions", {
        siteId,
        pageId,
        ...release,
        publishedBy: actor,
        publishedAt: Date.now(),
      }))
    await ctx.db.patch("pages", pageId, { liveVersionId: versionId })
    await syncForms(ctx, siteId)
    await writeAudit(ctx, {
      siteId,
      actor,
      action: "page.publish",
      target: page.path,
    })
    return versionId
  },
})

/** Point a page back at one of its older versions, once R2's live copy holds it. */
export const markRolledBack = internalMutation({
  args: {
    siteId: v.id("sites"),
    pageId: v.id("pages"),
    versionId: v.id("pageVersions"),
    actor: v.string(),
  },
  handler: async (ctx, { siteId, pageId, versionId, actor }) => {
    const page = await ownPage(ctx, siteId, pageId)
    const version = await ctx.db.get("pageVersions", versionId)
    if (!version || version.pageId !== pageId) throw fail("not_found")
    await ctx.db.patch("pages", pageId, { liveVersionId: versionId })
    await syncForms(ctx, siteId)
    await writeAudit(ctx, {
      siteId,
      actor,
      action: "page.rollback",
      target: page.path,
    })
  },
})
