import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter"
import {
  type EnquiryResponse,
  enquiryIntakeSchema,
  MAX_ENQUIRY_BYTES,
  sha256Hex,
  verifyRequest,
} from "@workspace/core"
import type { FormField } from "@workspace/html"
import { v } from "convex/values"
import { components, internal } from "./_generated/api"
import { httpAction, internalMutation } from "./_generated/server"
import { enquiryIntake } from "./validators"

const DEDUPE_WINDOW_MS = 10 * MINUTE
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const rateLimiter = new RateLimiter(components.rateLimiter, {
  enquiry: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 40 },
})

type FieldErrors = Record<string, string[]>
type Receipt =
  | { ok: true }
  | { ok: false; reason: "unknown_site" | "rate_limited" }
  | { ok: false; reason: "invalid"; errors: FieldErrors }

/** Check submitted fields against a form's registry entry from publish. */
function fieldErrors(
  fields: FormField[],
  data: Record<string, string>
): FieldErrors {
  const errors: FieldErrors = {}
  const add = (name: string, message: string) =>
    (errors[name] ??= []).push(message)
  const known = new Set(fields.map((field) => field.name))
  for (const name of Object.keys(data)) {
    if (!known.has(name)) add(name, "Unexpected field.")
  }
  for (const { name, type, required, maxLength } of fields) {
    const value = data[name] ?? ""
    if (!value.trim()) {
      if (required) add(name, "Required.")
      continue
    }
    if (maxLength !== undefined && value.length > maxLength) {
      add(name, `Too long (max ${maxLength}).`)
    }
    if (type === "email" && !EMAIL.test(value.trim())) {
      add(name, "Enter a valid email.")
    }
  }
  return errors
}

export const receive = internalMutation({
  args: {
    siteId: v.string(),
    ...enquiryIntake,
    bodyHash: v.string(),
  },
  handler: async (ctx, args): Promise<Receipt> => {
    const siteId = ctx.db.normalizeId("sites", args.siteId)
    const site = siteId && (await ctx.db.get("sites", siteId))
    if (!site) return { ok: false, reason: "unknown_site" }

    const form = await ctx.db
      .query("forms")
      .withIndex("by_site_name", (q) =>
        q.eq("siteId", site._id).eq("name", args.form)
      )
      .unique()
    const errors = form
      ? fieldErrors(form.fields, args.data)
      : { form: ["Unknown form."] }
    if (Object.keys(errors).length)
      return { ok: false, reason: "invalid", errors }

    const now = Date.now()
    const duplicate = await ctx.db
      .query("enquiries")
      .withIndex("by_site_hash", (q) =>
        q
          .eq("siteId", site._id)
          .eq("bodyHash", args.bodyHash)
          .gte("createdAt", now - DEDUPE_WINDOW_MS)
      )
      .first()
    if (duplicate) return { ok: true }

    const { ok } = await rateLimiter.limit(ctx, "enquiry", { key: site._id })
    if (!ok) return { ok: false, reason: "rate_limited" }

    await ctx.db.insert("enquiries", {
      siteId: site._id,
      form: args.form,
      data: args.data,
      source: args.source,
      status: "new",
      createdAt: now,
      bodyHash: args.bodyHash,
    })
    return { ok: true }
  },
})

const reply = (status: number, body?: EnquiryResponse) =>
  body ? Response.json(body, { status }) : new Response(null, { status })

/** Hash of the form and its fields, ignoring field order, for the dedupe window. */
const enquiryHash = (form: string, data: Record<string, string>) =>
  sha256Hex(
    JSON.stringify([
      form,
      Object.entries(data).sort(([a], [b]) => a.localeCompare(b)),
    ])
  )

function parse(body: Uint8Array) {
  try {
    return enquiryIntakeSchema.safeParse(
      JSON.parse(new TextDecoder().decode(body))
    )
  } catch {
    return undefined
  }
}

/** `POST /api/enquiries`: the edge's signed, already bot-checked form posts. */
export const intake = httpAction(async (ctx, request) => {
  const body = new Uint8Array(await request.arrayBuffer())
  if (body.byteLength > MAX_ENQUIRY_BYTES) return reply(413)

  const secret = process.env.R2C2_SIGNING_SECRET
  if (!secret) {
    console.error("R2C2_SIGNING_SECRET isn't set; refusing enquiries")
    return reply(503)
  }
  const siteId = await verifyRequest(secret, request, body)
  if (siteId === null) return reply(401)

  const parsed = parse(body)
  if (!parsed?.success) {
    return reply(400, { ok: false, errors: { body: ["Invalid enquiry."] } })
  }
  const { form, data, source } = parsed.data
  const receipt = await ctx.runMutation(internal.enquiries.receive, {
    siteId,
    form,
    data,
    source,
    bodyHash: await enquiryHash(form, data),
  })
  if (receipt.ok) return reply(201, { ok: true })
  if (receipt.reason === "invalid") {
    return reply(400, { ok: false, errors: receipt.errors })
  }
  return reply(receipt.reason === "unknown_site" ? 404 : 429)
})
