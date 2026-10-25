import {
  API_HEADERS,
  ENQUIRY_INTAKE_PATH,
  type EnquiryIntake,
  type EnquiryResponse,
  type EnquirySource,
  enquirySchema,
  FORMS_PREFIX,
  HONEYPOT_FIELD,
  MAX_ENQUIRY_BYTES,
  normaliseHost,
  signedHeaders,
  TURNSTILE_FIELD,
} from "@workspace/core"
import { lookup } from "./lookup"
import { builtInPage, escapeHtml, notFound } from "./responses"

const FORM_NAME = /^[a-z0-9-]+$/
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"

type FieldErrors = Record<string, string[]>
type Submission = {
  fields: Record<string, string>
  token?: string
  source?: EnquirySource
}

const MESSAGES: Record<number, string> = {
  400: "Please check the form",
  403: "We couldn't check that you're not a robot",
  404: "This form doesn't exist",
  413: "That message is too long",
  415: "That form can't be sent",
  429: "Too many messages, please try again in a minute",
}

function parse(type: string | null, body: Uint8Array): Submission | null {
  const text = new TextDecoder().decode(body)
  if (type?.startsWith("application/json")) {
    try {
      const parsed = enquirySchema.safeParse(JSON.parse(text))
      if (!parsed.success) return null
      const {
        [TURNSTILE_FIELD]: token,
        _source: source,
        ...fields
      } = parsed.data
      return { fields, token, source }
    } catch {
      return null
    }
  }
  if (type?.startsWith("application/x-www-form-urlencoded")) {
    const {
      [TURNSTILE_FIELD]: token,
      _source,
      ...fields
    } = Object.fromEntries(new URLSearchParams(text))
    return { fields, token: token || undefined }
  }
  return null
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
  const referer = request.headers.get("referer")
  return referer &&
    URL.canParse(referer) &&
    new URL(referer).origin === url.origin
    ? new URL(referer)
    : new URL("/", url)
}

function answer(request: Request, url: URL, form: string) {
  const wantsJson = request.headers.get("accept")?.includes("application/json")

  return (status: number, errors?: FieldErrors) => {
    if (wantsJson) {
      const body: EnquiryResponse | null =
        status === 201 ? { ok: true } : errors ? { ok: false, errors } : null
      return body
        ? Response.json(body, { status, headers: API_HEADERS })
        : new Response(null, { status, headers: API_HEADERS })
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
  env: { secret: string; convexUrl: string },
  siteId: string,
  intake: EnquiryIntake
) {
  const body = JSON.stringify(intake)
  const headers = await signedHeaders(env.secret, {
    siteId,
    method: "POST",
    path: ENQUIRY_INTAKE_PATH,
    body,
  })
  return fetch(new URL(ENQUIRY_INTAKE_PATH, env.convexUrl), {
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
  const entry = await lookup(env.ROUTES, normaliseHost(url))
  if (!entry || "redirect" in entry) return notFound()

  const reply = answer(request, url, form)
  const origin = request.headers.get("origin")
  if (origin && origin !== url.origin) return reply(403)

  const {
    R2C2_SIGNING_SECRET: secret,
    TURNSTILE_SECRET: turnstileSecret,
    CONVEX_SITE_URL: convexUrl,
  } = env
  if (!secret || !turnstileSecret || !convexUrl) {
    console.error("The forms route is missing a secret or CONVEX_SITE_URL")
    return reply(503)
  }

  const body = new Uint8Array(await request.arrayBuffer())
  if (body.byteLength > MAX_ENQUIRY_BYTES) return reply(413)
  const type = request.headers.get("content-type")
  if (
    !type?.startsWith("application/json") &&
    !type?.startsWith("application/x-www-form-urlencoded")
  ) {
    return reply(415)
  }
  const submission = parse(type, body)
  if (!submission) return reply(400, { body: ["Invalid enquiry."] })

  const { [HONEYPOT_FIELD]: honeypot, ...data } = submission.fields
  if (honeypot) return reply(201)

  const ip = request.headers.get("cf-connecting-ip") ?? ""
  if (submission.token) {
    if (!(await verifyTurnstile(turnstileSecret, submission.token, ip))) {
      return reply(403)
    }
  } else if (honeypot === undefined) {
    return reply(403)
  }

  const limiter = submission.token ? env.FORMS_LIMIT : env.FORMS_NOJS_LIMIT
  const { success } = await limiter.limit({ key: `${entry.site}:${ip}` })
  if (!success) return reply(429)

  try {
    const response = await forward({ secret, convexUrl }, entry.site, {
      form,
      data,
      source: submission.source,
    })
    if (response.status === 201) return reply(201)
    if (response.status === 400) {
      const result = await response.json<EnquiryResponse>()
      return reply(400, result.ok ? undefined : result.errors)
    }
    if (response.status === 404 || response.status === 429) {
      return reply(response.status)
    }
    console.error(`Convex refused an enquiry with ${response.status}`)
  } catch (error) {
    console.error("Couldn't reach Convex", error)
  }
  return reply(502)
}
