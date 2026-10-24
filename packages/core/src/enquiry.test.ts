import { describe, expect, it } from "vite-plus/test"
import { enquirySchema } from "./enquiry"

const valid = {
  name: "Ada",
  email: "ada@example.com",
  "cf-turnstile-response": "token",
  _source: { page: "/contact", referrer: "https://google.com", utm: {} },
}

describe("enquirySchema", () => {
  it("accepts declared fields with the turnstile token and source", () => {
    expect(enquirySchema.parse(valid)).toEqual(valid)
  })

  it("defaults utm and allows a missing referrer", () => {
    const { _source, ...rest } = enquirySchema.parse({
      ...valid,
      _source: { page: "/contact" },
    })
    expect(_source).toEqual({ page: "/contact", utm: {} })
    expect(rest.name).toBe("Ada")
  })

  it.each([
    ["a missing turnstile token", { "cf-turnstile-response": undefined }],
    ["an empty turnstile token", { "cf-turnstile-response": "" }],
    ["a missing source", { _source: undefined }],
    ["a source without a page", { _source: { utm: {} } }],
    ["a non-string field", { name: 42 }],
  ])("rejects %s", (_, change) => {
    expect(enquirySchema.safeParse({ ...valid, ...change }).success).toBe(false)
  })
})
