import {
  API_HEADERS,
  ENQUIRY_INTAKE_PATH,
  type EnquiryIntake,
  type EnquiryResponse,
  type EnquirySource,
  enquirySchema,
  FORM_NAME,
  FORMS_PREFIX,
  type FieldErrors,
  HONEYPOT_FIELD,
  MAX_ENQUIRY_BYTES,
  normaliseHost,
  signedHeaders,
  TURNSTILE_FIELD,
} from "@workspace/core"
import { lookup } from "./lookup"
import { builtInPage, escapeHtml, notFound } from "./responses"

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

const MESSAGES: Record<number, string> = {
  400: "Please check the form",
  403: "We couldn't check that you're not a robot",
  404: "This form doesn't exist",
  413: "That message is too long",
  415: "That form can't be sent",
  429: "Too many messages, please try again in a minute",
}

type BodyKind = "json" | "form"
type RawSubmission = Record<string, string> & { _source?: EnquirySource }

function bodyKind(type: string | null): BodyKind | null {
  if (type?.startsWith("application/json")) return "json"
  if (type?.startsWith("application/x-www-form-urlencoded")) return "form"
  return null
}

/** Split a post into its bot-check parts and the fields Convex checks. */
function parse(kind: BodyKind, body: Uint8Array) {
  const text = new TextDecoder().decode(body)
  let raw: RawSubmission
  if (kind === "form") {
    const { _source, ...fields } = Object.fromEntries(new URLSearchParams(text))
    raw = fields
  } else {
    try {
      const parsed = enquirySchema.safeParse(JSON.parse(text))
      if (!parsed.success) return null
      raw = parsed.data
    } catch {
      return null
    }
  }
  const {
    [TURNSTILE_FIELD]: token,
    [HONEYPOT_FIELD]: honeypot,
    _source: source,
    ...data
  } = raw
  return { token: token || undefined, honeypot, source, data }
}

async function verifyTurnstile(secret: string, token: string, ip: string) {
  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    })
    const result = await response.json<{ success?: boolean }>()
    return result.success === true
  } catch (error) {
    console.error("Turnstile check failed", error)
    return false
  }
}

/** The page a form was posted from, if it's on this site. */
function formPage(request: Request, url: URL) {
  const referer = URL.parse(request.headers.get("referer") ?? "")
  return referer?.origin === url.origin ? referer : new URL("/", url)
}

function answer(request: Request, url: URL, form: string) {
  const wantsJson = request.headers.get("accept")?.includes("application/json")

  return (status: number, errors?: FieldErrors) => {
    if (wantsJson) {
      if (status !== 201 && !errors) {
        return new Response(null, { status, headers: API_HEADERS })
      }
      const body: EnquiryResponse =
        status === 201 ? { ok: true } : { ok: false, errors: errors! }
      return Response.json(body, { status, headers: API_HEADERS })
    }
    const page = formPage(request, url)
    if (status === 201) {
      page.searchParams.set("sent", form)
      return new Response(null, {
        status: 303,
        headers: { ...API_HEADERS, location: page.href },
      })
    }
    const list = Object.entries(errors ?? {})
      .map(
        ([field, messages]) =>
          `<li>${escapeHtml(`${field}: ${messages.join(" ")}`)}</li>`
      )
      .join("")
    const body = `${list && `<ul>${list}</ul>`}<p><a href="${escapeHtml(page.href)}">Go back</a></p>`
    return new Response(
      builtInPage(MESSAGES[status] ?? "Something went wrong", body),
      {
        status,
        headers: { ...API_HEADERS, "content-type": "text/html; charset=utf-8" },
      }
    )
  }
}

async function forward(
  secret: string,
  convexUrl: string,
  siteId: string,
  intake: EnquiryIntake
) {
  const body = JSON.stringify(intake)
  const headers = await signedHeaders(secret, {
    siteId,
    method: "POST",
    path: ENQUIRY_INTAKE_PATH,
    body,
  })
  return fetch(new URL(ENQUIRY_INTAKE_PATH, convexUrl), {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body,
  })
}

/** `POST /_api/forms/:form`: check a form post and forward it, signed, to Convex. */
export async function handleForm(
  request: Request,
  env: Cloudflare.Env,
  url: URL
) {
  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: { ...API_HEADERS, allow: "POST" },
    })
  }
  const form = url.pathname.slice(FORMS_PREFIX.length)
  if (!FORM_NAME.test(form)) return notFound()

  const reply = answer(request, url, form)
  const origin = request.headers.get("origin")
  if (origin && origin !== url.origin) return reply(403)

  const { R2C2_SIGNING_SECRET, TURNSTILE_SECRET, CONVEX_SITE_URL } = env
  if (!R2C2_SIGNING_SECRET || !TURNSTILE_SECRET || !CONVEX_SITE_URL) {
    console.error("The forms route is missing a secret or CONVEX_SITE_URL")
    return reply(503)
  }

  const kind = bodyKind(request.headers.get("content-type"))
  if (!kind) return reply(415)
  if (Number(request.headers.get("content-length")) > MAX_ENQUIRY_BYTES) {
    return reply(413)
  }

  const entry = await lookup(env.ROUTES, normaliseHost(url))
  if (!entry || "redirect" in entry) return notFound()

  const body = new Uint8Array(await request.arrayBuffer())
  if (body.byteLength > MAX_ENQUIRY_BYTES) return reply(413)
  const submission = parse(kind, body)
  if (!submission) return reply(400, { body: ["Invalid enquiry."] })

  const { token, honeypot, source, data } = submission
  if (honeypot) return reply(201)
  if (!token && honeypot === undefined) return reply(403)

  const ip = request.headers.get("cf-connecting-ip") ?? ""
  const limiter = token ? env.FORMS_LIMIT : env.FORMS_NOJS_LIMIT
  const { success } = await limiter.limit({ key: `${entry.site}:${ip}` })
  if (!success) return reply(429)
  if (token && !(await verifyTurnstile(TURNSTILE_SECRET, token, ip))) {
    return reply(403)
  }

  try {
    const response = await forward(
      R2C2_SIGNING_SECRET,
      CONVEX_SITE_URL,
      entry.site,
      { form, data, source }
    )
    if (response.status === 400) {
      const result = await response.json<EnquiryResponse>()
      return reply(400, result.ok ? undefined : result.errors)
    }
    if ([201, 404, 429].includes(response.status)) return reply(response.status)
    console.error(`Convex refused an enquiry with ${response.status}`)
  } catch (error) {
    console.error("Couldn't reach Convex", error)
  }
  return reply(502)
}
