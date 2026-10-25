import { describe, expect, it } from "vite-plus/test"
import {
  enquiryCampaign,
  enquiryIntakeSchema,
  enquirySchema,
  enquirySummary,
} from "./enquiry"

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

describe("enquiryIntakeSchema", () => {
  it("accepts a forwarded enquiry with or without a source", () => {
    const intake = { form: "contact", data: { name: "Ada" } }
    expect(enquiryIntakeSchema.parse(intake)).toEqual(intake)
    expect(
      enquiryIntakeSchema.parse({ ...intake, source: { page: "/contact" } })
    ).toEqual({ ...intake, source: { page: "/contact", utm: {} } })
  })

  it.each([
    ["a missing form", { data: {} }],
    ["an empty form", { form: "", data: {} }],
    ["non-string data", { form: "c", data: { n: 1 } }],
  ])("rejects %s", (_, body) => {
    expect(enquiryIntakeSchema.safeParse(body).success).toBe(false)
  })
})

describe("enquirySummary", () => {
  it("joins the first filled-in values", () => {
    expect(
      enquirySummary({
        name: "Ada",
        phone: " ",
        email: "ada@example.com",
        note: "Hi",
      })
    ).toBe("Ada · ada@example.com")
  })
})

describe("enquiryCampaign", () => {
  it("drops the utm_ prefix", () => {
    expect(
      enquiryCampaign({ utm_source: "newsletter", utm_campaign: "launch" })
    ).toBe("source: newsletter, campaign: launch")
  })

  it("is empty without UTM values", () => {
    expect(enquiryCampaign({})).toBe("")
  })
})
