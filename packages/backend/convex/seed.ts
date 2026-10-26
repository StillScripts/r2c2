import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import { internalMutation, type MutationCtx } from "./_generated/server"
import { enquiryHash } from "./enquiries"
import { fail } from "./errors"
import { writeAudit } from "./access"
import { draftHistory, recordDraft } from "./history"
import { pageAt, writeDraft } from "./pages"
import { scheduleRouteSync } from "./routes"
import { createSite, findSite } from "./sites"

/** The slug of the site the seed creates, and the default for `staff:create`. */
export const SEED_SLUG = "r2c2"

const THEME = `@theme {
  --color-brand: oklch(0.45 0.12 250);
  --color-ink: oklch(0.2 0 0);
  --color-paper: oklch(0.99 0 0);
  --font-sans: "Inter Variable", sans-serif;
  --radius-card: 0.75rem;
}`

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

/** Create the r2c2 site, at r2c2.<SITES_DOMAIN>, with a sample enquiry. Safe to rerun, and a rerun syncs its routes again. */
export default internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await findSite(ctx, SEED_SLUG)
    const siteId =
      existing?._id ??
      (await createSite(ctx, { name: "R2C2", slug: SEED_SLUG, theme: THEME }))
    await seedEnquiry(ctx, siteId)
    if (existing) await scheduleRouteSync(ctx, existing)
    return siteId
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
