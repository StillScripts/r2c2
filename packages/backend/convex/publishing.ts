import { primaryDomain } from "@workspace/core"
import type { FormDefinition } from "@workspace/html"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { loadSite, writeAudit } from "./access"
import { fail } from "./errors"
import { recordDraft } from "./history"
import { domainsOf } from "./routes"
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
  const live = await Promise.all(
    pages.map(async ({ _id, liveVersionId }) => {
      const version =
        liveVersionId && (await ctx.db.get("pageVersions", liveVersionId))
      return version ? { pageId: _id, version } : null
    })
  )
  return live.filter((entry) => entry !== null)
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

async function ownVersion(
  ctx: QueryCtx,
  pageId: Id<"pages">,
  versionId: Id<"pageVersions">
) {
  const version = await ctx.db.get("pageVersions", versionId)
  if (!version || version.pageId !== pageId) throw fail("not_found")
  return version
}

/** The page and the forms on the site's other live pages, loaded as the signed-in member. */
async function pageContext(
  ctx: QueryCtx,
  siteId: Id<"sites">,
  pageId: Id<"pages">
) {
  const { site, userId } = await loadSite(ctx, siteId)
  const page = await ownPage(ctx, siteId, pageId)
  const otherForms = (await livePages(ctx, siteId))
    .filter((live) => live.pageId !== pageId)
    .flatMap((live) => live.version.forms)
  return { site, userId, page, otherForms }
}

export const publishContext = internalQuery({
  args: { siteId: v.id("sites"), pageId: v.id("pages") },
  handler: async (ctx, { siteId, pageId }) => {
    const { site, page, ...rest } = await pageContext(ctx, siteId, pageId)
    const primary = primaryDomain(await domainsOf(ctx, siteId))
    return {
      ...rest,
      page,
      theme: site.theme,
      canonicalUrl: primary
        ? `https://${primary.hostname}${page.path}`
        : undefined,
    }
  },
})

export const rollbackContext = internalQuery({
  args: {
    siteId: v.id("sites"),
    pageId: v.id("pages"),
    versionId: v.id("pageVersions"),
  },
  handler: async (ctx, { siteId, pageId, versionId }) => {
    const { site: _, ...context } = await pageContext(ctx, siteId, pageId)
    return { ...context, version: await ownVersion(ctx, pageId, versionId) }
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

    const published = { publishedBy: actor, publishedAt: Date.now() }
    const existing = await ctx.db
      .query("pageVersions")
      .withIndex("by_page_hash", (q) =>
        q.eq("pageId", pageId).eq("hash", release.hash)
      )
      .unique()
    // Republishing an identical page reuses its version, as the latest publish
    if (existing) await ctx.db.patch("pageVersions", existing._id, published)
    const versionId =
      existing?._id ??
      (await ctx.db.insert("pageVersions", {
        siteId,
        pageId,
        ...release,
        ...published,
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
    await ownVersion(ctx, pageId, versionId)
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
