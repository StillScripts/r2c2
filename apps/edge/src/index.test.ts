import { env, exports } from "cloudflare:workers"
import { liveKey } from "@workspace/core"
import { describe, expect, it } from "vite-plus/test"

const get = (url: string) => exports.default.fetch(url)

describe("edge worker", () => {
  it("routes through the gateway to the renderer", async () => {
    await env.SITES.put(liveKey("gateway.test", "/"), "<p>Home</p>")
    const response = await get("https://gateway.test/")
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("<p>Home</p>")
  })

  it("passes the normalised host and path to the renderer", async () => {
    await env.SITES.put(liveKey("normalised.test", "/about"), "<p>About</p>")
    const response = await get("https://Normalised.Test./About/?utm_source=x")
    expect(await response.text()).toBe("<p>About</p>")
  })

  it("rejects paths that escape the site", async () => {
    const response = await get("https://gateway.test/about%5c..%5csecret")
    expect(response.status).toBe(404)
  })
})
