import { isSiteSlug } from "@workspace/core"
import { v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { audit, loadSite, siteMutation, siteQuery, writeAudit } from "./access"
import { siteAddress } from "./domains"
import { scheduleRouteSync } from "./routes"
import { siteStatus } from "./validators"

/** The site with this slug, or null. */
export const findSite = (ctx: QueryCtx, slug: string) =>
  ctx.db
    .query("sites")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique()

/** Create a coming-soon site with its own address as primary domain and an empty home page, then sync its routes. */
export async function createSite(
  ctx: MutationCtx,
  { name, slug, theme = "" }: { name: string; slug: string; theme?: string }
) {
  if (!isSiteSlug(slug)) {
    throw new Error(
      `"${slug}" isn't a site slug: use lowercase letters, numbers and hyphens, at most 63, and not a reserved name like "www".`
    )
  }
  if (await findSite(ctx, slug)) {
    throw new Error(`A site with slug "${slug}" already exists`)
  }

  const siteId = await ctx.db.insert("sites", {
    name,
    slug,
    status: "coming-soon",
    theme,
  })
  await ctx.db.insert("domains", {
    siteId,
    hostname: siteAddress(slug),
    kind: "address",
    status: "active",
  })
  await ctx.db.insert("pages", {
    siteId,
    path: "/",
    title: name,
    draftHtml: "",
  })
  await writeAudit(ctx, {
    siteId,
    actor: "system",
    action: "site.create",
    target: siteId,
  })
  await scheduleRouteSync(ctx, { _id: siteId })
  return siteId
}

/** Replace a site's theme and record who did it. Pages pick it up when they're next published. */
export async function writeTheme(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  theme: string,
  actor: string
) {
  await ctx.db.patch("sites", siteId, { theme })
  await writeAudit(ctx, { siteId, actor, action: "site.theme", target: siteId })
}

/** Save a theme that `theme:save` has already compiled. Owners only, like rename. */
export const setTheme = internalMutation({
  args: { siteId: v.id("sites"), theme: v.string() },
  handler: async (ctx, { siteId, theme }) => {
    const { userId } = await loadSite(ctx, siteId, "owner")
    await writeTheme(ctx, siteId, theme, userId)
  },
})

/**
 * Create a site at `<slug>.<SITES_DOMAIN>`, until the Loft can. Run from the CLI, then add
 * its owner with `staff:create`:
 * `vp exec convex run sites:create '{"name": "Acme Dental", "slug": "acme-dental"}'`
 */
export const create = internalMutation({
  args: { name: v.string(), slug: v.string() },
  handler: (ctx, args) => createSite(ctx, args),
})

/** The site, with the caller's role on it so the Loft can show owner-only controls. */
export const get = siteQuery({
  args: {},
  handler: (ctx) => ({ ...ctx.site, role: ctx.membership.role }),
})

export const rename = siteMutation({
  role: "owner",
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    await ctx.db.patch("sites", ctx.site._id, { name })
    await audit(ctx, { action: "site.rename", target: ctx.site._id })
  },
})

export const setStatus = siteMutation({
  role: "owner",
  args: { status: siteStatus },
  handler: async (ctx, { status }) => {
    await ctx.db.patch("sites", ctx.site._id, { status })
    await audit(ctx, { action: "site.status", target: status })
    await scheduleRouteSync(ctx, ctx.site)
  },
})
