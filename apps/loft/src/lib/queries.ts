import { convexQuery } from "@convex-dev/react-query"
import { api } from "@workspace/backend/api"
import type { Id } from "@workspace/backend/dataModel"

export const meQuery = convexQuery(api.staff.me, {})

export const siteQuery = (siteId: Id<"sites">) =>
  convexQuery(api.sites.get, { siteId })

export const pagesQuery = (siteId: Id<"sites">) =>
  convexQuery(api.pages.list, { siteId })

export const pageQuery = (siteId: Id<"sites">, pageId: Id<"pages">) =>
  convexQuery(api.pages.get, { siteId, pageId })

export const versionsQuery = (siteId: Id<"sites">, pageId: Id<"pages">) =>
  convexQuery(api.pages.versions, { siteId, pageId })

export const historyQuery = (siteId: Id<"sites">, pageId: Id<"pages">) =>
  convexQuery(api.pages.history, { siteId, pageId })
