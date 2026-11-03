import type { Id } from "@workspace/backend/dataModel"

export const parseSiteParams = (params: { siteId: string }) => ({
  siteId: params.siteId as Id<"sites">,
})

export const parsePageParams = (params: { pageId: string }) => ({
  pageId: params.pageId as Id<"pages">,
})

export const parseEnquiryParams = (params: { enquiryId: string }) => ({
  enquiryId: params.enquiryId as Id<"enquiries">,
})
