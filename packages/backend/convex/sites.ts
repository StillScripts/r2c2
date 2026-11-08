import { isSiteSlug, readColours } from "@workspace/core"
import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { audit, loadSite, siteMutation, siteQuery, writeAudit } from "./access"
import { siteAddress } from "./domains"
import { scheduleRouteSync } from "./routes"
import { fail } from "./errors"
import { type SiteKind, siteKind, siteStatus } from "./validators"

/** The site with this slug, or null. */
export const findSite = (ctx: QueryCtx, slug: string) =>
  ctx.db
    .query("sites")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique()

/** The theme's `--color-brand` value, for the site's badge in the Loft, or null if it has none. */
export const brandOf = (theme: string) =>
  readColours(theme).find(({ name }) => name === "brand")?.value ?? null

export const kindOf = (site: Pick<Doc<"sites">, "kind">): SiteKind =>
  site.kind ?? "pages"

/** Refuse page and theme edits on an app site, whose content is its build (ADR-019). */
export function assertPagesSite(site: Pick<Doc<"sites">, "kind">) {
  if (kindOf(site) === "app") throw fail("app_site")
}

/**
 * Create a coming-soon site with its own address as primary domain, then sync its routes.
 * A pages site starts with an empty home page; an app site has no pages.
 */
export async function createSite(
  ctx: MutationCtx,
  {
    name,
    slug,
    kind = "pages",
    theme = "",
  }: { name: string; slug: string; kind?: SiteKind; theme?: string }
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
    kind,
    theme,
  })
  await ctx.db.insert("domains", {
    siteId,
    hostname: siteAddress(slug),
    kind: "address",
    status: "active",
  })
  if (kind === "pages") {
    await ctx.db.insert("pages", {
      siteId,
      path: "/",
      title: name,
      draftHtml: "",
    })
  }
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
  site: Doc<"sites">,
  theme: string,
  actor: string
) {
  assertPagesSite(site)
  await ctx.db.patch("sites", site._id, { theme })
  await writeAudit(ctx, {
    siteId: site._id,
    actor,
    action: "site.theme",
    target: site._id,
  })
}

/** Save a theme that `theme:save` has already compiled. Owners only, like rename. */
export const setTheme = internalMutation({
  args: { siteId: v.id("sites"), theme: v.string() },
  handler: async (ctx, { siteId, theme }) => {
    const { site, userId } = await loadSite(ctx, siteId, "owner")
    await writeTheme(ctx, site, theme, userId)
  },
})

/**
 * Create a site at `<slug>.<SITES_DOMAIN>`, until the Loft can. Run from the CLI, then add
 * its owner with `staff:create`. Pass `"kind": "app"` for a site deployed from a build:
 * `vp exec convex run sites:create '{"name": "Acme Dental", "slug": "acme-dental"}'`
 */
export const create = internalMutation({
  args: { name: v.string(), slug: v.string(), kind: v.optional(siteKind) },
  handler: (ctx, args) => createSite(ctx, args),
})

/** The site, with the caller's role on it so the Loft can show owner-only controls. */
export const get = siteQuery({
  args: {},
  handler: (ctx) => ({
    ...ctx.site,
    kind: kindOf(ctx.site),
    role: ctx.membership.role,
  }),
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
