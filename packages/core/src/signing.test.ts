import { describe, expect, it } from "vite-plus/test"
import { sign, signedHeaders, verify, type SignedRequest } from "./signing"

const secret = "test-secret"
const now = Date.UTC(2026, 9, 24, 12)
const body = '{"name":"Ada"}'
const request: SignedRequest = {
  siteId: "s_r2c2",
  method: "POST",
  path: "/_api/forms/contact",
  body,
}

describe("sign", () => {
  it("formats the header as t=<seconds>,v1=<hex>", async () => {
    expect(await sign(secret, request, now)).toMatch(
      new RegExp(`^t=${now / 1000},v1=[0-9a-f]{64}$`)
    )
  })

  it("matches a known HMAC-SHA256 of the canonical string", async () => {
    expect(await sign(secret, request, now)).toBe(
      "t=1792843200,v1=f7e32b4731b43e86824cad7aa532ca5ef9a5114f61bef25367c956d0ffd6a987"
    )
  })

  it("adds the site header", async () => {
    expect(await signedHeaders(secret, request, now)).toEqual({
      "x-r2c2-signature": await sign(secret, request, now),
      "x-r2c2-site": "s_r2c2",
    })
  })
})

describe("verify", () => {
  it("accepts a fresh signature", async () => {
    const header = await sign(secret, request, now)
    expect(await verify(secret, request, header, now)).toBe(true)
  })

  it("accepts byte bodies and lowercase methods", async () => {
    const header = await sign(secret, request, now)
    const bytes = {
      ...request,
      method: "post",
      body: new TextEncoder().encode(body),
    }
    expect(await verify(secret, bytes, header, now)).toBe(true)
  })

  it("accepts a signature at the edge of the 60-second window", async () => {
    const header = await sign(secret, request, now)
    expect(await verify(secret, request, header, now + 60_000)).toBe(true)
  })

  it("rejects an expired signature", async () => {
    const header = await sign(secret, request, now)
    expect(await verify(secret, request, header, now + 61_000)).toBe(false)
  })

  it("rejects a signature from the future", async () => {
    const header = await sign(secret, request, now + 61_000)
    expect(await verify(secret, request, header, now)).toBe(false)
  })

  it("rejects the wrong secret", async () => {
    const header = await sign("other-secret", request, now)
    expect(await verify(secret, request, header, now)).toBe(false)
  })

  it.each([
    ["siteId", { siteId: "s_other" }],
    ["method", { method: "PUT" }],
    ["path", { path: "/_api/forms/other" }],
    ["body", { body: '{"name":"Eve"}' }],
  ])("rejects a tampered %s", async (_, change) => {
    const header = await sign(secret, request, now)
    expect(await verify(secret, { ...request, ...change }, header, now)).toBe(
      false
    )
  })

  it("rejects a tampered timestamp", async () => {
    const header = await sign(secret, request, now)
    const shifted = header.replace(/t=\d+/, `t=${now / 1000 + 1}`)
    expect(await verify(secret, request, shifted, now)).toBe(false)
  })

  it("rejects a tampered signature", async () => {
    const header = await sign(secret, request, now)
    const flipped = header.replace(/.$/, (c) => (c === "0" ? "1" : "0"))
    expect(await verify(secret, request, flipped, now)).toBe(false)
  })

  it.each([
    null,
    undefined,
    "",
    "v1=abc",
    `t=${now / 1000}`,
    `t=${now / 1000},v1=xyz`,
    `t=${now / 1000},v1=${"a".repeat(63)}`,
    `t=-1,v1=${"a".repeat(64)}`,
  ])("rejects a malformed header %j", async (header) => {
    expect(await verify(secret, request, header, now)).toBe(false)
  })
})
