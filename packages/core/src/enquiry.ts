import { z } from "zod"

export const MAX_ENQUIRY_BYTES = 32 * 1024

export const enquirySourceSchema = z.object({
  page: z.string(),
  referrer: z.string().optional(),
  utm: z.record(z.string(), z.string()).default({}),
})

export const enquirySchema = z
  .object({
    "cf-turnstile-response": z.string().min(1),
    _source: enquirySourceSchema,
  })
  .catchall(z.string())

export type EnquirySource = z.infer<typeof enquirySourceSchema>
export type Enquiry = z.infer<typeof enquirySchema>

export type EnquiryResponse =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> }
