import { internalMutation } from "./_generated/server"

const THEME = `@theme {
  --color-brand: oklch(0.45 0.12 250);
  --color-ink: oklch(0.2 0 0);
  --color-paper: oklch(0.99 0 0);
  --font-sans: "Inter Variable", sans-serif;
  --radius-card: 0.75rem;
}`

/** Create the r2c2 site, its local domains and an empty home page. Safe to rerun. */
export default internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", "r2c2"))
      .unique()
    if (existing) return existing._id

    const siteId = await ctx.db.insert("sites", {
      name: "R2C2",
      slug: "r2c2",
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
    return siteId
  },
})
