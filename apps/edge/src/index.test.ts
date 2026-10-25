import { env, exports } from "cloudflare:workers"
import {
  comingSoonHeaders,
  liveKey,
  type RouteEntry,
  routeKey,
} from "@workspace/core"
import { describe, expect, it } from "vite-plus/test"

const get = (url: string, init?: RequestInit) =>
  exports.default.fetch(new Request(url, { redirect: "manual", ...init }))

const route = (host: string, entry: unknown) =>
  env.ROUTES.put(routeKey(host), JSON.stringify(entry))

const live = (host: string, site: string) =>
  route(host, { site, status: "live" } satisfies RouteEntry)

describe("gateway", () => {
  it("never lets two sites share a page at the same path", async () => {
    await live("a.test", "site_a")
    await live("b.test", "site_b")
    await env.SITES.put(liveKey("site_a", "/about"), "<p>About A</p>")
    await env.SITES.put(liveKey("site_b", "/about"), "<p>About B</p>")

    for (const [host, body] of [
      ["a.test", "<p>About A</p>"],
      ["b.test", "<p>About B</p>"],
      ["a.test", "<p>About A</p>"],
    ]) {
      expect(await (await get(`https://${host}/about`)).text()).toBe(body)
    }
  })

  it("renders the site from KV, normalising the host and path", async () => {
    await live("normalised.test", "site_n")
    await env.SITES.put(liveKey("site_n", "/about"), "<p>About</p>")
    const response = await get("https://Normalised.Test./About/?utm_source=x")
    expect(await response.text()).toBe("<p>About</p>")
  })

  it("returns an uncached 404 for an unknown host", async () => {
    const response = await get("https://unknown.test/")
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("treats a malformed entry as unknown", async () => {
    await route("broken.test", { site: "" })
    expect((await get("https://broken.test/")).status).toBe(404)
  })

  it("rejects paths that escape the site", async () => {
    await live("escape.test", "site_e")
    expect((await get("https://escape.test/about%5c..%5csecret")).status).toBe(
      404
    )
  })

  it("redirects to the primary domain, keeping the path and query", async () => {
    await route("www.r.test", { redirect: "https://r.test" })
    const response = await get("https://www.r.test/About?x=1&utm_source=y")

    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe(
      "https://r.test/About?x=1&utm_source=y"
    )
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600")
  })

  it("redirects paths the renderer would reject", async () => {
    await route("www.bad.test", { redirect: "https://bad.test" })
    const response = await get("https://www.bad.test/a/../b")
    expect(response.status).toBe(301)
  })

  it("shows the holding page for a coming-soon site", async () => {
    await route("soon.test", { site: "site_s", status: "coming-soon" })
    await env.SITES.put(liveKey("site_s", "/"), "<p>Unreleased</p>")
    const response = await get("https://soon.test/")

    expect(response.status).toBe(200)
    expect(await response.text()).toContain("Coming soon")
    expect(Object.fromEntries(response.headers)).toMatchObject(
      comingSoonHeaders("site_s")
    )
  })

  it("serves HEAD without a body for every outcome", async () => {
    await live("head.test", "site_h")
    await env.SITES.put(liveKey("site_h", "/"), "<p>Home</p>")
    await route("soon-head.test", { site: "site_sh", status: "coming-soon" })

    for (const host of ["head.test", "soon-head.test"]) {
      const response = await get(`https://${host}/`, { method: "HEAD" })
      expect(response.status).toBe(200)
      expect(await response.text()).toBe("")
    }
  })

  it.each(["live.test", "soon.test", "unknown.test"])(
    "refuses other methods on %s",
    async (host) => {
      await live("live.test", "site_l")
      const response = await get(`https://${host}/`, { method: "POST" })
      expect(response.status).toBe(405)
      expect(response.headers.get("allow")).toBe("GET, HEAD")
    }
  )
})
