import { v } from "convex/values"

export const siteStatus = v.union(v.literal("live"), v.literal("coming-soon"))
export const domainKind = v.union(v.literal("primary"), v.literal("redirect"))
export const domainStatus = v.union(v.literal("pending"), v.literal("active"))
export const enquiryStatus = v.union(v.literal("new"), v.literal("handled"))
export const role = v.union(v.literal("owner"), v.literal("editor"))

// Same shapes as FormField in packages/html and EnquirySource in packages/core
export const formField = v.object({
  name: v.string(),
  type: v.string(),
  required: v.boolean(),
  maxLength: v.optional(v.number()),
})
export const formDefinition = v.object({
  name: v.string(),
  fields: v.array(formField),
})
export const enquirySource = v.object({
  page: v.string(),
  referrer: v.optional(v.string()),
  utm: v.record(v.string(), v.string()),
})
