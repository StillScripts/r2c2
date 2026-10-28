import { describe, expect, it } from "vite-plus/test"
import { CLEAN_BODY, page, THEME } from "./fixtures"
import { ID_ATTRIBUTE } from "./ids"
import { HONEYPOT_FIELD } from "@workspace/core"
import { buildRelease, type ReleaseOptions } from "./release"
import { loadTheme } from "./theme"

const options: ReleaseOptions = {
  theme: await loadTheme(THEME),
  canonicalUrl: "https://clinic.example/",
  sitekey: "1x00000000000000000000AA",
  elementsUrl: "/_elements/abc.js",
  cssUrl: (hash) => `/assets/${hash}.css`,
}

const PLAIN = page(`<h1 class="text-ink">Welcome</h1>`)
const WITH_FORM = page(CLEAN_BODY)

async function release(draft: string, overrides: Partial<ReleaseOptions> = {}) {
  const result = await buildRelease(draft, { ...options, ...overrides })
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result
}

describe("buildRelease", () => {
  it("assembles a plain page with its doctype, canonical URL and CSS", async () => {
    const result = await release(PLAIN)
    expect(result.html.startsWith("<!doctype html>\n<html")).toBe(true)
    expect(result.html.match(/<!doctype/gi)).toHaveLength(1)
    expect(result.html).toContain(
      '<link rel="canonical" href="https://clinic.example/">'
    )
    expect(result.html).toContain(
      `<link rel="stylesheet" href="/assets/${result.cssHash}.css">`
    )
    expect(result.html).not.toContain("<script")
    expect(result.css).toContain(".text-ink")
    expect(result.forms).toEqual([])
  })

  it("leaves out the canonical link without a primary domain", async () => {
    const result = await release(PLAIN, { canonicalUrl: undefined })
    expect(result.html).not.toContain("canonical")
  })

  it("hashes the finished page", async () => {
    const first = await release(PLAIN)
    const html = first.draftWithIds
    expect((await release(html)).hash).toBe(first.hash)
    expect(
      (await release(html, { canonicalUrl: "https://other.example/" })).hash
    ).not.toBe(first.hash)
    expect(
      (await release(html.replace("text-ink", "text-brand"))).hash
    ).not.toBe(first.hash)
  })

  it("gives elements IDs and keeps them in the published page", async () => {
    const result = await release(PLAIN)
    const id = /data-r2c2-id="(\w+)"/.exec(result.draftWithIds)?.[1]
    expect(id).toBeDefined()
    expect(result.html).toContain(`${ID_ATTRIBUTE}="${id}"`)
  })

  it("adds the elements script, sitekey and honeypot to pages with a form", async () => {
    const result = await release(WITH_FORM)
    expect(result.html).toContain(
      '<script type="module" src="/_elements/abc.js"></script>'
    )
    expect(result.html).toMatch(
      /<site-form name="contact" [^>]*sitekey="1x00000000000000000000AA"/
    )
    expect(result.html).toMatch(
      new RegExp(
        `<form [^>]*><input name="${HONEYPOT_FIELD}" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true">`
      )
    )
    expect(result.css).toContain(".sr-only")
    expect(result.forms).toEqual([
      {
        name: "contact",
        fields: [
          { name: "email", type: "email", required: true, maxLength: 200 },
        ],
      },
    ])
  })

  it("refuses a form without a sitekey", async () => {
    const result = await buildRelease(WITH_FORM, {
      ...options,
      sitekey: undefined,
    })
    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ rule: "sitekey" })],
    })
  })

  it("refuses a form with its own honeypot-named field", async () => {
    const draft = page(
      CLEAN_BODY.replace('name="email"', `name="${HONEYPOT_FIELD}"`)
    )
    const result = await buildRelease(draft, options)
    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ rule: "honeypot" })],
    })
  })

  it("publishes a page that only has warnings", async () => {
    const result = await release(
      page(`<h1 class="text-ink eyebrow bg-[#1f5b8a]">Welcome</h1>`)
    )
    expect(result.css).toContain(".text-ink")
    expect(result.css).toContain("#1f5b8a")
  })

  it("returns house-rule errors instead of a page", async () => {
    const result = await buildRelease(page(`<p hidden>x</p>`), options)
    expect(result.ok).toBe(false)
    expect(result).not.toHaveProperty("html")
  })
})
