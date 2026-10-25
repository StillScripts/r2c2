import type { Id } from "./_generated/dataModel"
import { internalMutation, type MutationCtx } from "./_generated/server"
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

/** Give the seed site one enquiry to show in the inbox, unless it already has some. */
async function seedEnquiry(ctx: MutationCtx, siteId: Id<"sites">) {
  const existing = await ctx.db
    .query("enquiries")
    .withIndex("by_site_status_created", (q) => q.eq("siteId", siteId))
    .first()
  if (existing) return
  await ctx.db.insert("enquiries", {
    siteId,
    form: "contact",
    data: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Hello! Could you tell me more about R2C2?",
    },
    source: {
      page: "/contact",
      referrer: "https://www.google.com/",
      utm: { utm_source: "newsletter", utm_campaign: "launch" },
    },
    status: "new",
    createdAt: Date.now(),
    bodyHash: "seed",
  })
}

/** Create the r2c2 site, its local domains, an empty home page and a sample enquiry, then sync its routes. Safe to rerun. */
export default internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", SEED_SLUG))
      .unique()
    if (existing) {
      await seedEnquiry(ctx, existing._id)
      await scheduleRouteSync(ctx, existing)
      return existing._id
    }

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
      await ctx.db.insert("domains", {
        siteId,
        hostname,
        kind,
        status: "active",
      })
    }
    await ctx.db.insert("pages", {
      siteId,
      path: "/",
      title: "R2C2",
      draftHtml: "",
    })
    await seedEnquiry(ctx, siteId)
    await scheduleRouteSync(ctx, { _id: siteId })
    return siteId
  },
})
