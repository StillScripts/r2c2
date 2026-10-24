import { describe, expect, it } from "vite-plus/test"
import { routeEntrySchema } from "./routing"

describe("routeEntrySchema", () => {
  it.each([
    { site: "s_r2c2", status: "live" },
    { site: "s_r2c2", status: "coming-soon" },
    { redirect: "https://r2c2.dev" },
  ])("accepts %j", (entry) => {
    expect(routeEntrySchema.parse(entry)).toEqual(entry)
  })

  it.each([
    { site: "s_r2c2", status: "draft" },
    { site: "", status: "live" },
    { redirect: "not a url" },
    {},
  ])("rejects %j", (entry) => {
    expect(routeEntrySchema.safeParse(entry).success).toBe(false)
  })
})
