import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import {
  domainKind,
  domainStatus,
  enquirySource,
  enquiryStatus,
  formDefinition,
  formField,
  role,
  siteStatus,
} from "./validators"

export default defineSchema({
  sites: defineTable({
    name: v.string(),
    slug: v.string(),
    status: siteStatus,
    // CSS with the site's @theme tokens and @utility component classes
    theme: v.string(),
    // Bumped on every change KV must reflect, so stale route syncs skip
    routesVersion: v.optional(v.number()),
  }).index("by_slug", ["slug"]),

  domains: defineTable({
    siteId: v.id("sites"),
    hostname: v.string(),
    kind: domainKind,
    status: domainStatus,
  })
    .index("by_hostname", ["hostname"])
    .index("by_site", ["siteId"]),

  pages: defineTable({
    siteId: v.id("sites"),
    path: v.string(),
    title: v.string(),
    draftHtml: v.string(),
    liveVersionId: v.optional(v.id("pageVersions")),
  }).index("by_site_path", ["siteId", "path"]),

  pageVersions: defineTable({
    siteId: v.id("sites"),
    pageId: v.id("pages"),
    hash: v.string(),
    cssHash: v.string(),
    forms: v.array(formDefinition),
    publishedBy: v.string(),
    publishedAt: v.number(),
  }).index("by_page", ["pageId"]),

  // The registry enquiry intake checks against, updated at publish
  forms: defineTable({
    siteId: v.id("sites"),
    name: v.string(),
    fields: v.array(formField),
  }).index("by_site_name", ["siteId", "name"]),

  enquiries: defineTable({
    siteId: v.id("sites"),
    form: v.string(),
    data: v.record(v.string(), v.string()),
    // absent for no-JS form posts
    source: v.optional(enquirySource),
    status: enquiryStatus,
    createdAt: v.number(),
    // SHA-256 of the form name and sorted fields, for the 10-minute dedupe
    bodyHash: v.string(),
  })
    .index("by_site_created", ["siteId", "createdAt"])
    .index("by_site_hash", ["siteId", "bodyHash", "createdAt"]),

  memberships: defineTable({
    // identity.subject, the Better Auth user ID
    userId: v.string(),
    siteId: v.id("sites"),
    role,
  })
    .index("by_user_site", ["userId", "siteId"])
    .index("by_site", ["siteId"]),

  auditLog: defineTable({
    siteId: v.id("sites"),
    // a user ID, or "system" for internal callers
    actor: v.string(),
    action: v.string(),
    target: v.string(),
    at: v.number(),
  }).index("by_site_at", ["siteId", "at"]),
})
