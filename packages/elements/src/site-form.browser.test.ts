import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page,
} from "playwright"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vite-plus/test"
import { build } from "vite-plus/pack"
import { PACK } from "../vite.config"

const ORIGIN = "https://site.test"

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Contact</title>
<script type="module" src="/site-elements.js"></script></head>
<body><site-form name="contact" sitekey="test-key">
<form method="post" action="/_api/forms/contact">
<label for="name">Name</label><input id="name" name="name" required>
<label for="email">Email</label><input id="email" name="email" type="email">
<input name="website" aria-hidden="true" tabindex="-1">
<button type="submit">Send</button>
</form></site-form></body></html>`

const TURNSTILE_STUB = `window.turnstile = {
  render(container) {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = "cf-turnstile-response"
    input.value = "token-123"
    container.append(input)
    return "widget-1"
  },
  reset() {},
}`

let reply: { status: number; body?: unknown }
let received: { type?: string; body: string }[]
let script = ""
let browser: Browser
let context: BrowserContext | undefined

beforeAll(async () => {
  const outDir = await mkdtemp(path.join(tmpdir(), "site-elements-"))
  await build({
    ...PACK,
    cwd: path.resolve(import.meta.dirname, ".."),
    config: false,
    outDir,
    logLevel: "silent",
  })
  script = await readFile(path.join(outDir, "site-elements.js"), "utf8")
  browser = await chromium.launch()
})

afterAll(() => browser?.close())

beforeEach(() => {
  received = []
  reply = { status: 201, body: { ok: true } }
})

afterEach(() => context?.close())

async function openPage(javaScriptEnabled: boolean, query = "") {
  context = await browser.newContext({ javaScriptEnabled })
  const page = await context.newPage()
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({ contentType: "text/javascript", body: TURNSTILE_STUB })
  )
  await page.route(`${ORIGIN}/**`, (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    if (pathname === "/site-elements.js") {
      return route.fulfill({ contentType: "text/javascript", body: script })
    }
    if (request.method() !== "POST") {
      return route.fulfill({ contentType: "text/html", body: PAGE })
    }
    const type = request.headers()["content-type"]
    received.push({ type, body: request.postData() ?? "" })
    if (type === "application/x-www-form-urlencoded") {
      return route.fulfill({ contentType: "text/html", body: "<p>Sent</p>" })
    }
    return route.fulfill({ status: reply.status, json: reply.body ?? {} })
  })
  await page.goto(`${ORIGIN}/contact${query}`)
  return page
}

async function fillAndSend(page: Page) {
  await page.fill("#name", "Ada")
  await page.fill("#email", "ada@example.com")
  await page.click("button[type=submit]")
}

describe("<site-form>", () => {
  it("posts the form natively with JavaScript off", async () => {
    const page = await openPage(false)
    await fillAndSend(page)
    await page.waitForSelector("text=Sent")
    expect(received).toEqual([
      {
        type: "application/x-www-form-urlencoded",
        body: "name=Ada&email=ada%40example.com&website=",
      },
    ])
  })

  it("submits JSON with the Turnstile token and source", async () => {
    const page = await openPage(true, "?utm_source=news&utm_medium=email&ref=x")
    await page.fill("#name", "Ada")
    await page.waitForSelector("input[name=cf-turnstile-response]", {
      state: "attached",
    })
    await fillAndSend(page)
    await page.waitForSelector("site-form[data-state=sent]")

    expect(page.url()).toBe(
      `${ORIGIN}/contact?utm_source=news&utm_medium=email&ref=x`
    )
    expect(await page.textContent("[role=status]")).toBe(
      "Thanks, your message has been sent."
    )
    expect(await page.inputValue("#name")).toBe("")
    expect(received).toHaveLength(1)
    expect(received[0]!.type).toBe("application/json")
    expect(JSON.parse(received[0]!.body)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      website: "",
      "cf-turnstile-response": "token-123",
      _source: {
        page: "/contact",
        referrer: "",
        utm: { utm_source: "news", utm_medium: "email" },
      },
    })
  })

  it("doesn't load Turnstile until the form is used", async () => {
    const page = await openPage(true)
    expect(await page.evaluate(() => "turnstile" in window)).toBe(false)
  })

  it("marks the fields a 400 names", async () => {
    reply = {
      status: 400,
      body: { ok: false, errors: { email: ["Enter a valid email."] } },
    }
    const page = await openPage(true)
    await fillAndSend(page)
    await page.waitForSelector("site-form[data-state=error]")

    expect(await page.getAttribute("#email", "aria-invalid")).toBe("true")
    expect(await page.getAttribute("#email", "aria-describedby")).toBe(
      "contact-email-error"
    )
    expect(await page.textContent("#contact-email-error")).toBe(
      "Enter a valid email."
    )
    expect(await page.textContent("[role=status]")).toBe(
      "Please fix the highlighted fields."
    )
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("email")
  })

  it("shows a general error for other failures", async () => {
    reply = { status: 500 }
    const page = await openPage(true)
    await fillAndSend(page)
    await page.waitForSelector("site-form[data-state=error]")
    expect(await page.textContent("[role=status]")).toBe(
      "Sorry, something went wrong. Please try again."
    )
    expect(await page.isEnabled("button[type=submit]")).toBe(true)
  })

  it.each([
    ["confirms its own form", "?sent=contact", "sent"],
    ["ignores another form's confirmation", "?sent=newsletter", "idle"],
  ])("%s after a no-JS post", async (_, query, state) => {
    const page = await openPage(true, query)
    await page.waitForSelector(`site-form[data-state=${state}]`)
  })
})
