import type { EnquiryIntake, EnquirySource, RouteEntry } from "@workspace/core"
import type { FormDefinition, FormField } from "@workspace/html"
import { literals } from "convex-helpers/validators"
import { type Infer, type ObjectType, v } from "convex/values"

export const siteStatus = literals("live", "coming-soon")
export const domainKind = literals("primary", "redirect")
export const domainStatus = literals("pending", "active")
export const enquiryStatus = literals("new", "handled")
export const role = literals("owner", "editor")

export type Role = Infer<typeof role>

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
export const enquiryIntake = {
  form: v.string(),
  data: v.record(v.string(), v.string()),
  source: v.optional(enquirySource),
}

// Fails to type check if these drift from the shapes in packages/core and packages/html
type Same<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
type Expect<T extends true> = T
export type SharedShapes = [
  Expect<
    Same<
      Infer<typeof siteStatus>,
      Extract<RouteEntry, { status: unknown }>["status"]
    >
  >,
  Expect<Same<Infer<typeof formField>, FormField>>,
  Expect<Same<Infer<typeof formDefinition>, FormDefinition>>,
  Expect<Same<Infer<typeof enquirySource>, EnquirySource>>,
  Expect<Same<ObjectType<typeof enquiryIntake>, EnquiryIntake>>,
]
