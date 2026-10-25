import { env, exports } from "cloudflare:workers"
import { routeKey, verifyRequest } from "@workspace/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

type Forwarded = { siteId: string | null; body: unknown }

let forwarded: Forwarded[]
let turnstilePasses: boolean
let convexReply: () => Response

let sites = 0
async function site() {
  const host = `forms-${++sites}.test`
  await env.ROUTES.put(
    routeKey(host),
    JSON.stringify({ site: `site_${sites}`, status: "live" })
  )
  return { host, siteId: `site_${sites}` }
}

beforeEach(() => {
  forwarded = []
  turnstilePasses = true
  convexReply = () => Response.json({ ok: true }, { status: 201 })
  const realFetch = globalThis.fetch
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    if (request.url.startsWith("https://challenges.cloudflare.com/")) {
      return Response.json({ success: turnstilePasses })
    }
    if (request.url.startsWith("https://convex.test/")) {
      const body = new Uint8Array(await request.arrayBuffer())
      const siteId = await verifyRequest(
        env.R2C2_SIGNING_SECRET!,
        request,
        body
      )
      forwarded.push({
        siteId,
        body: JSON.parse(new TextDecoder().decode(body)),
      })
      return convexReply()
    }
    return realFetch(input, init)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const source = { page: "/contact", utm: {} }
const fields = { name: "Ada", email: "ada@example.com" }

function postJson(
  host: string,
  body: object,
  headers: Record<string, string> = {}
) {
  return exports.default.fetch(
    new Request(`https://${host}/_api/forms/contact`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "cf-connecting-ip": "203.0.113.1",
        ...headers,
      },
      body: JSON.stringify(body),
    })
  )
}

function postForm(
  host: string,
  body: Record<string, string>,
  headers: Record<string, string> = {}
) {
  return exports.default.fetch(
    new Request(`https://${host}/_api/forms/contact`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "cf-connecting-ip": "203.0.113.2",
        referer: `https://${host}/contact`,
        ...headers,
      },
      body: new URLSearchParams(body),
    })
  )
}

const jsBody = {
  ...fields,
  website: "",
  "cf-turnstile-response": "token",
  _source: source,
}

describe("forms route: JavaScript posts", () => {
  it("forwards a verified post to Convex, signed for the site", async () => {
    const { host, siteId } = await site()
    const response = await postJson(host, jsBody)

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(forwarded).toEqual([
      { siteId, body: { form: "contact", data: fields, source } },
    ])
  })

  it("refuses a post that fails Turnstile", async () => {
    const { host } = await site()
    turnstilePasses = false
    expect((await postJson(host, jsBody)).status).toBe(403)
    expect(forwarded).toEqual([])
  })

  it("pretends a filled honeypot worked and forwards nothing", async () => {
    const { host } = await site()
    const response = await postJson(host, { ...jsBody, website: "spam" })
    expect(response.status).toBe(201)
    expect(forwarded).toEqual([])
  })

  it("passes Convex's field errors through", async () => {
    const { host } = await site()
    const errors = { email: ["Enter a valid email."] }
    convexReply = () => Response.json({ ok: false, errors }, { status: 400 })
    const response = await postJson(host, jsBody)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, errors })
  })

  it.each([
    [429, 429],
    [404, 404],
    [500, 502],
    [401, 502],
  ])("maps a Convex %i to %i", async (from, to) => {
    const { host } = await site()
    convexReply = () => new Response(null, { status: from })
    expect((await postJson(host, jsBody)).status).toBe(to)
  })
})

describe("forms route: posts without JavaScript", () => {
  it("forwards a post with an empty honeypot and redirects back as sent", async () => {
    const { host, siteId } = await site()
    const response = await postForm(host, { ...fields, website: "" })

    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      `https://${host}/contact?sent=contact`
    )
    expect(forwarded).toEqual([
      { siteId, body: { form: "contact", data: fields } },
    ])
  })

  it("refuses a post without the honeypot field", async () => {
    const { host } = await site()
    expect((await postForm(host, fields)).status).toBe(403)
  })

  it("redirects to the home page when the referer is another site", async () => {
    const { host } = await site()
    const response = await postForm(
      host,
      { ...fields, website: "" },
      { referer: "https://elsewhere.test/" }
    )
    expect(response.headers.get("location")).toBe(
      `https://${host}/?sent=contact`
    )
  })

  it("shows field errors as an escaped HTML list", async () => {
    const { host } = await site()
    convexReply = () =>
      Response.json(
        { ok: false, errors: { "<b>": ["Too long (max 20)."] } },
        { status: 400 }
      )
    const response = await postForm(host, { ...fields, website: "" })
    const html = await response.text()

    expect(response.status).toBe(400)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(html).toContain("<li>&lt;b&gt;: Too long (max 20).</li>")
    expect(html).toContain(`href="https://${host}/contact"`)
  })

  it("limits honeypot-only posts to 3 a minute per visitor", async () => {
    const { host } = await site()
    const statuses = []
    for (let n = 0; n < 4; n++) {
      statuses.push(
        (await postForm(host, { ...fields, message: `m${n}`, website: "" }))
          .status
      )
    }
    expect(statuses).toEqual([303, 303, 303, 429])
  })
})

describe("forms route: guards", () => {
  it("returns 404 for unknown hosts, redirect hosts and bad form names", async () => {
    await env.ROUTES.put(
      routeKey("www.forms.test"),
      JSON.stringify({ redirect: "https://forms.test" })
    )
    const { host } = await site()
    expect((await postJson("unknown.test", jsBody)).status).toBe(404)
    expect((await postJson("www.forms.test", jsBody)).status).toBe(404)
    const badName = await exports.default.fetch(
      new Request(`https://${host}/_api/forms/Bad_Name`, { method: "POST" })
    )
    expect(badName.status).toBe(404)
  })

  it("refuses posts from another origin", async () => {
    const { host } = await site()
    const response = await postJson(host, jsBody, {
      origin: "https://elsewhere.test",
    })
    expect(response.status).toBe(403)
  })

  it("refuses bodies over 32 KB", async () => {
    const { host } = await site()
    const response = await postJson(host, {
      ...jsBody,
      message: "x".repeat(33 * 1024),
    })
    expect(response.status).toBe(413)
  })

  it("refuses other content types and malformed JSON", async () => {
    const { host } = await site()
    expect(
      (await postJson(host, jsBody, { "content-type": "text/plain" })).status
    ).toBe(415)
    const malformed = await exports.default.fetch(
      new Request(`https://${host}/_api/forms/contact`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: "{",
      })
    )
    expect(malformed.status).toBe(400)
  })

  it("only accepts POST", async () => {
    const { host } = await site()
    const response = await exports.default.fetch(
      `https://${host}/_api/forms/contact`
    )
    expect(response.status).toBe(405)
    expect(response.headers.get("allow")).toBe("POST")
  })
})
