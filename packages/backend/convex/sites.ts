import { v } from "convex/values"
import { audit, siteMutation, siteQuery } from "./access"
import { scheduleRouteSync } from "./routes"
import { siteStatus } from "./validators"

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
