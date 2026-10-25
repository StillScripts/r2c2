import { env, exports } from "cloudflare:workers"
import {
  assetHeaders,
  assetKey,
  elementsKey,
  liveKey,
  type LivePageMetadata,
  notFoundHeaders,
  notFoundKey,
  pageHeaders,
} from "@workspace/core"
import { describe, expect, it } from "vite-plus/test"

const HASH = "0123456789abcdef"
const page = "<!doctype html><title>Home</title>"
const metadata: LivePageMetadata = { pageId: "p_home", hash: "v1" }

let sites = 0
/** A fresh site per test, so neither R2 nor Workers Cache leaks between tests. */
const site = () => `site_${++sites}`

const putPage = (siteId: string, path = "/") =>
  env.SITES.put(liveKey(siteId, path), page, { customMetadata: metadata })

const request = (siteId: string, path: string, init?: RequestInit) =>
  exports
    .Renderer({ props: { siteId } })
    .fetch(`https://site.test${path}`, init)

const headersOf = (response: Response) =>
  Object.fromEntries(response.headers.entries())

describe("renderer pages", () => {
  it("serves a live page with the page headers", async () => {
    const siteId = site()
    await putPage(siteId, "/about")
    const response = await request(siteId, "/about")

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(page)
    expect(headersOf(response)).toMatchObject(
      pageHeaders({ siteId, ...metadata })
    )
  })

  it("tags by site and uses R2's etag when the metadata is missing", async () => {
    const siteId = site()
    const object = await env.SITES.put(liveKey(siteId, "/"), page)
    const response = await request(siteId, "/")

    expect(response.headers.get("cache-tag")).toBe(`site-${siteId}`)
    expect(response.headers.get("etag")).toBe(`"${object!.etag}"`)
  })

  it("answers a matching if-none-match with 304", async () => {
    const siteId = site()
    await putPage(siteId)
    const response = await request(siteId, "/", {
      headers: { "if-none-match": '"v1"' },
    })

    expect(response.status).toBe(304)
    expect(response.headers.get("etag")).toBe('"v1"')
  })
})

describe("renderer not found", () => {
  it("serves the site's 404 page", async () => {
    const siteId = site()
    await env.SITES.put(notFoundKey(siteId), "<h1>Lost?</h1>")
    const response = await request(siteId, "/missing")

    expect(response.status).toBe(404)
    expect(await response.text()).toBe("<h1>Lost?</h1>")
    expect(headersOf(response)).toMatchObject(notFoundHeaders(siteId))
  })

  it("falls back to a built-in 404 page", async () => {
    const siteId = site()
    const response = await request(siteId, "/missing")

    expect(response.status).toBe(404)
    expect(await response.text()).toContain("Page not found")
    expect(headersOf(response)).toMatchObject(notFoundHeaders(siteId))
  })
})

describe("renderer assets", () => {
  it.each([
    ["css", "text/css; charset=utf-8"],
    ["webp", "image/webp"],
  ])("serves a %s asset as immutable", async (ext, contentType) => {
    const siteId = site()
    await env.SITES.put(assetKey(siteId, HASH, ext), "asset")
    const response = await request(siteId, `/assets/${HASH}.${ext}`)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("asset")
    expect(headersOf(response)).toMatchObject(assetHeaders(contentType))
  })

  it("doesn't serve another site's asset", async () => {
    const owner = site()
    await env.SITES.put(assetKey(owner, HASH, "css"), "asset")
    const response = await request(site(), `/assets/${HASH}.css`)
    expect(response.status).toBe(404)
  })

  it.each([
    ["a malformed name", "/assets/not-a-hash.css"],
    ["an unknown extension", `/assets/${HASH}.svg`],
    ["a non-JS elements file", `/_elements/${HASH}.css`],
  ])("returns a plain 404 for %s", async (_, path) => {
    const siteId = site()
    await env.SITES.put(assetKey(siteId, HASH, "svg"), "<svg/>")
    await env.SITES.put(notFoundKey(siteId), "<h1>Lost?</h1>")
    const response = await request(siteId, path)
    expect(response.status).toBe(404)
    expect(await response.text()).toBe("Not found")
  })

  it("serves the shared elements script", async () => {
    await env.SITES.put(elementsKey(HASH), "customElements.define()")
    const response = await request(site(), `/_elements/${HASH}.js`)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("customElements.define()")
    expect(headersOf(response)).toMatchObject(
      assetHeaders("text/javascript; charset=utf-8")
    )
  })
})
