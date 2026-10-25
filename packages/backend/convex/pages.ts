import { v } from "convex/values"
import { ownDoc, siteQuery } from "./access"

export const get = siteQuery({
  args: { pageId: v.id("pages") },
  handler: (ctx, { pageId }) => ownDoc(ctx, "pages", pageId),
})
