import { convexQuery } from "@convex-dev/react-query"
import { api } from "@workspace/backend/api"
import type { Doc, Id } from "@workspace/backend/dataModel"

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

export const snapshotQuery = (
  siteId: Id<"sites">,
  pageId: Id<"pages">,
  ts: number
) => convexQuery(api.pages.snapshot, { siteId, pageId, ts })

export type EnquiryStatus = Doc<"enquiries">["status"]

export const enquiriesQuery = (siteId: Id<"sites">, status: EnquiryStatus) =>
  convexQuery(api.enquiries.list, { siteId, status })

export const newEnquiriesQuery = (siteId: Id<"sites">) =>
  convexQuery(api.enquiries.newCount, { siteId })

export const enquiryQuery = (siteId: Id<"sites">, enquiryId: Id<"enquiries">) =>
  convexQuery(api.enquiries.get, { siteId, enquiryId })
