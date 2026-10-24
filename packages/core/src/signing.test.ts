import { describe, expect, it } from "vite-plus/test"
import { sign, signedHeaders, verify, type SignedRequest } from "./signing"

const secret = "test-secret"
const now = Date.UTC(2026, 9, 24, 12)
const request: SignedRequest = {
  siteId: "s_r2c2",
  method: "POST",
  path: "/_api/forms/contact",
  body: '{"name":"Ada"}',
}

describe("sign", () => {
  it("formats the header as t=<seconds>,v1=<hex>", async () => {
    expect(await sign(secret, request, now)).toMatch(
      new RegExp(`^t=${now / 1000},v1=[0-9a-f]{64}$`)
    )
  })

  it("matches an independent HMAC of the canonical string", async () => {
    const encoder = new TextEncoder()
    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(request.body as string)
    )
    const hex = (buffer: ArrayBuffer) =>
      Array.from(new Uint8Array(buffer), (b) =>
        b.toString(16).padStart(2, "0")
      ).join("")
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const message = `${now / 1000}\ns_r2c2\nPOST\n/_api/forms/contact\n${hex(digest)}`
    const expected = hex(
      await crypto.subtle.sign("HMAC", key, encoder.encode(message))
    )
    expect(await sign(secret, request, now)).toBe(
      `t=${now / 1000},v1=${expected}`
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
      body: new TextEncoder().encode(request.body as string),
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
