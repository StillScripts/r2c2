import { v } from "convex/values"
import { audit, siteMutation, siteQuery } from "./access"

export const get = siteQuery({
  args: {},
  handler: async (ctx) => ctx.site,
})

export const rename = siteMutation({
  role: "owner",
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    await ctx.db.patch("sites", ctx.site._id, { name })
    await audit(ctx, { action: "site.rename", target: ctx.site._id })
  },
})
