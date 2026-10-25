import type { Id } from "@workspace/backend/dataModel"

export const parseSiteParams = (params: { siteId: string }) => ({
  siteId: params.siteId as Id<"sites">,
})

export const parsePageParams = (params: {
  siteId: string
  pageId: string
}) => ({
  ...parseSiteParams(params),
  pageId: params.pageId as Id<"pages">,
})

export const parseEnquiryParams = (params: {
  siteId: string
  enquiryId: string
}) => ({
  ...parseSiteParams(params),
  enquiryId: params.enquiryId as Id<"enquiries">,
})
