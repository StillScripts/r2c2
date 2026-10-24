import { exports } from "cloudflare:workers"
import { describe, expect, it } from "vite-plus/test"

const get = (url: string) => exports.default.fetch(url)

describe("edge worker", () => {
  it("routes through the gateway to the renderer", async () => {
    const response = await get("https://r2c2.dev/")
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("Hello from r2c2.dev/")
  })

  it("passes the normalised host and path to the renderer", async () => {
    const response = await get("https://R2C2.Dev./About/?utm_source=x")
    expect(await response.text()).toBe("Hello from r2c2.dev/about")
  })

  it("rejects paths that escape the site", async () => {
    const response = await get("https://r2c2.dev/about%5c..%5csecret")
    expect(response.status).toBe(404)
  })
})
