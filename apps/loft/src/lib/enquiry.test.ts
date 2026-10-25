import { describe, expect, it } from "vite-plus/test"
import { campaign, summary } from "./enquiry"

describe("summary", () => {
  it("joins the first filled-in values", () => {
    expect(
      summary({ name: "Ada", phone: " ", email: "ada@example.com", note: "Hi" })
    ).toBe("Ada · ada@example.com")
  })
})

describe("campaign", () => {
  it("drops the utm_ prefix", () => {
    expect(campaign({ utm_source: "newsletter", utm_campaign: "launch" })).toBe(
      "source: newsletter, campaign: launch"
    )
  })

  it("is empty without UTM values", () => {
    expect(campaign({})).toBe("")
  })
})
