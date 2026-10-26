import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { enquiryHash } from "./enquiries"
import { fail } from "./errors"
import { writeAudit } from "./access"
import { draftHistory, recordDraft } from "./history"
import { pageAt, writeDraft } from "./pages"
import { scheduleRouteSync } from "./routes"

/** The slug of the site the seed creates, and the default for `staff:create`. */
export const SEED_SLUG = "r2c2"

const THEME = `@theme {
  --color-brand: oklch(0.45 0.12 250);
  --color-ink: oklch(0.2 0 0);
  --color-paper: oklch(0.99 0 0);
  --font-sans: "Inter Variable", sans-serif;
  --radius-card: 0.75rem;
}`

/** The site with this slug, or null. */
export const findSite = (ctx: QueryCtx, slug: string) =>
  ctx.db
    .query("sites")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique()

/** Give the seed site one enquiry to show in the inbox, unless it already has some. */
async function seedEnquiry(ctx: MutationCtx, siteId: Id<"sites">) {
  const existing = await ctx.db
    .query("enquiries")
    .withIndex("by_site_status_created", (q) => q.eq("siteId", siteId))
    .first()
  if (existing) return
  const data = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "Hello! Could you tell me more about R2C2?",
  }
  await ctx.db.insert("enquiries", {
    siteId,
    form: "contact",
    data,
    source: {
      page: "/contact",
      referrer: "https://www.google.com/",
      utm: { utm_source: "newsletter", utm_campaign: "launch" },
    },
    status: "new",
    createdAt: Date.now(),
    bodyHash: await enquiryHash("contact", data),
  })
}

async function createSite(ctx: MutationCtx) {
  const siteId = await ctx.db.insert("sites", {
    name: "R2C2",
    slug: SEED_SLUG,
    status: "coming-soon",
    theme: THEME,
  })
  for (const [hostname, kind] of [
    ["r2c2.localhost", "primary"],
    ["www.r2c2.localhost", "redirect"],
  ] as const) {
    await ctx.db.insert("domains", { siteId, hostname, kind, status: "active" })
  }
  await ctx.db.insert("pages", {
    siteId,
    path: "/",
    title: "R2C2",
    draftHtml: "",
  })
  return siteId
}

/** Create the r2c2 site, its local domains, an empty home page and a sample enquiry, then sync its routes. Safe to rerun. */
export default internalMutation({
  args: {},
  handler: async (ctx) => {
    const site = (await findSite(ctx, SEED_SLUG)) ?? {
      _id: await createSite(ctx),
    }
    await seedEnquiry(ctx, site._id)
    await scheduleRouteSync(ctx, site)
    return site._id
  },
})

async function emptyPage(ctx: MutationCtx, siteId: Id<"sites">, path: string) {
  const pageId = await ctx.db.insert("pages", {
    siteId,
    path,
    title: path,
    draftHtml: "",
  })
  return (await ctx.db.get("pages", pageId))!
}

/** Snapshot a page's draft before an import replaces it, unless history already has it. */
async function keepDraft(ctx: MutationCtx, page: Doc<"pages">) {
  if (!page.draftHtml) return
  const [last] = await draftHistory(ctx, page._id, 1)
  if (last?.draftHtml === page.draftHtml) return
  await recordDraft(ctx, page, { reason: "import", actor: "system" })
}

/** Load a site's theme and/or page drafts from `sites/<slug>/`, creating pages that don't exist yet. Publishing stays a Loft step. */
export const importSite = internalMutation({
  args: {
    slug: v.optional(v.string()),
    theme: v.optional(v.string()),
    pages: v.array(v.object({ path: v.string(), html: v.string() })),
  },
  handler: async (ctx, { slug = SEED_SLUG, theme, pages }) => {
    const site = await findSite(ctx, slug)
    if (!site) throw fail("not_found")
    const log = (action: string, target: string) =>
      writeAudit(ctx, { siteId: site._id, actor: "system", action, target })
    if (theme !== undefined) {
      await ctx.db.patch("sites", site._id, { theme })
      await log("site.theme", site._id)
    }

    for (const { path: rawPath, html } of pages) {
      const { path, page } = await pageAt(ctx, site._id, rawPath)
      if (page) await keepDraft(ctx, page)
      else await log("page.create", path)
      const target = page ?? (await emptyPage(ctx, site._id, path))
      const saved = await writeDraft(ctx, target, html)
      await recordDraft(ctx, saved, { reason: "import", actor: "system" })
    }
    return site._id
  },
})
