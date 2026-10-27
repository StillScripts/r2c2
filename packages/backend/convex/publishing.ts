import { primaryDomain } from "@workspace/core"
import type { FormDefinition } from "@workspace/html"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalMutation,
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

/** How long a publish or rollback holds its page before another may take it over. */
export const CLAIM_MS = 2 * 60 * 1000

const claimOf = (ctx: QueryCtx, pageId: Id<"pages">) =>
  ctx.db
    .query("pageClaims")
    .withIndex("by_page", (q) => q.eq("pageId", pageId))
    .unique()

const isActive = (claim: Doc<"pageClaims">) => claim.expiresAt > Date.now()

/** Refuse a change to the page's draft while a publish or rollback holds it. */
export async function assertUnclaimed(ctx: QueryCtx, pageId: Id<"pages">) {
  const claim = await claimOf(ctx, pageId)
  if (claim && isActive(claim)) throw fail("page_busy")
}

/**
 * Refuse forms defined differently on another live page or another page's claim, so
 * two pages publishing at once can't both put a clashing form in R2.
 */
async function checkForms(
  ctx: QueryCtx,
  siteId: Id<"sites">,
  pageId: Id<"pages">,
  forms: FormDefinition[]
) {
  const claims = await ctx.db
    .query("pageClaims")
    .withIndex("by_site", (q) => q.eq("siteId", siteId))
    .collect()
  const others = [
    ...(await livePages(ctx, siteId))
      .filter((live) => live.pageId !== pageId)
      .flatMap((live) => live.version.forms),
    ...claims
      .filter((claim) => claim.pageId !== pageId && isActive(claim))
      .flatMap((claim) => claim.forms),
  ]
  const clash = formClash(forms, others)
  if (clash) throw fail("form_conflict", { form: clash })
}

/**
 * Claim the page as the signed-in member, so no other publish, rollback or save runs on
 * it, holding `forms` for it.
 */
async function claimPage(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  pageId: Id<"pages">,
  forms: FormDefinition[] = []
) {
  const { site, userId } = await loadSite(ctx, siteId)
  const page = await ownPage(ctx, siteId, pageId)
  const held = await claimOf(ctx, pageId)
  if (held) {
    if (isActive(held)) throw fail("page_busy")
    await ctx.db.delete("pageClaims", held._id)
  }
  await checkForms(ctx, siteId, pageId, forms)
  const claimId = await ctx.db.insert("pageClaims", {
    siteId,
    pageId,
    expiresAt: Date.now() + CLAIM_MS,
    forms,
  })
  return { claimId, site, userId, page }
}

/** Claim a page to publish it, returning what the build needs. */
export const claimPublish = internalMutation({
  args: { siteId: v.id("sites"), pageId: v.id("pages") },
  handler: async (ctx, { siteId, pageId }) => {
    const { site, page, ...rest } = await claimPage(ctx, siteId, pageId)
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

/** Hold the forms a claimed publish will put live, once its build has found them. */
export const holdForms = internalMutation({
  args: { claimId: v.id("pageClaims"), forms: v.array(formDefinition) },
  handler: async (ctx, { claimId, forms }) => {
    const claim = await ctx.db.get("pageClaims", claimId)
    if (!claim || !isActive(claim)) throw fail("page_busy")
    await checkForms(ctx, claim.siteId, claim.pageId, forms)
    await ctx.db.patch("pageClaims", claimId, { forms })
  },
})

/** Claim a page to put one of its versions back live. */
export const claimRollback = internalMutation({
  args: {
    siteId: v.id("sites"),
    pageId: v.id("pages"),
    versionId: v.id("pageVersions"),
  },
  handler: async (ctx, { siteId, pageId, versionId }) => {
    const version = await ownVersion(ctx, pageId, versionId)
    const { claimId, userId, page } = await claimPage(
      ctx,
      siteId,
      pageId,
      version.forms
    )
    return { claimId, userId, page, version }
  },
})

/** Let the page go once its publish or rollback has finished or failed. */
export const release = internalMutation({
  args: { claimId: v.id("pageClaims") },
  handler: async (ctx, { claimId }) => {
    if (await ctx.db.get("pageClaims", claimId)) {
      await ctx.db.delete("pageClaims", claimId)
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
