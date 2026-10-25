import { z } from "zod"

export const MAX_ENQUIRY_BYTES = 32 * 1024

export const FORMS_PREFIX = "/_api/forms/"
/** Form names become part of the post URL, so they're URL-safe slugs. */
export const FORM_NAME = /^[a-z0-9-]+$/
export const TURNSTILE_FIELD = "cf-turnstile-response"
/** The hidden honeypot field publish adds to every form; the edge checks it. */
export const HONEYPOT_FIELD = "website"

export const enquirySourceSchema = z.object({
  page: z.string(),
  referrer: z.string().optional(),
  utm: z.record(z.string(), z.string()).default({}),
})

export const enquirySchema = z
  .object({
    [TURNSTILE_FIELD]: z.string().min(1),
    _source: enquirySourceSchema,
  })
  .catchall(z.string())

export type EnquirySource = z.infer<typeof enquirySourceSchema>
export type Enquiry = z.infer<typeof enquirySchema>

export type FieldErrors = Record<string, string[]>

export type EnquiryResponse = { ok: true } | { ok: false; errors: FieldErrors }

/** The path the edge signs and posts enquiries to on the Convex site URL. */
export const ENQUIRY_INTAKE_PATH = "/api/enquiries"

/** What the edge forwards to Convex, with bot-check fields already stripped. */
export const enquiryIntakeSchema = z.object({
  form: z.string().regex(FORM_NAME),
  data: z.record(z.string(), z.string()),
  source: enquirySourceSchema.optional(),
})

export type EnquiryIntake = z.infer<typeof enquiryIntakeSchema>

/** The first few filled-in values, for a one-line preview of an enquiry. */
export const enquirySummary = (data: Record<string, string>, count = 2) =>
  Object.values(data)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, count)
    .join(" · ")

/** The `utm_*` values without their prefix, like "source: newsletter, campaign: launch". */
export const enquiryCampaign = (utm: Record<string, string>) =>
  Object.entries(utm)
    .map(([key, value]) => `${key.replace(/^utm_/, "")}: ${value}`)
    .join(", ")
