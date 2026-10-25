import { z } from "zod"

export const MAX_ENQUIRY_BYTES = 32 * 1024

export const FORMS_PREFIX = "/_api/forms/"
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

export type EnquiryResponse =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> }

/** The path the edge signs and posts enquiries to on the Convex site URL. */
export const ENQUIRY_INTAKE_PATH = "/api/enquiries"

/** What the edge forwards to Convex, with bot-check fields already stripped. */
export const enquiryIntakeSchema = z.object({
  form: z.string().min(1),
  data: z.record(z.string(), z.string()),
  source: enquirySourceSchema.optional(),
})

export type EnquiryIntake = z.infer<typeof enquiryIntakeSchema>
