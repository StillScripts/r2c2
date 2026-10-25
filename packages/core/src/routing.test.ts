import { describe, expect, it } from "vite-plus/test"
import { routeEntries, routeEntrySchema } from "./routing"

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

const site = { id: "site1", status: "live" as const }
const active = (hostname: string, kind: "primary" | "redirect") => ({
  hostname,
  kind,
  status: "active" as const,
})

describe("routeEntries", () => {
  it("points the primary at the site and redirects at the primary", () => {
    expect(
      routeEntries(site, [
        active("r2c2.dev", "primary"),
        active("www.r2c2.dev", "redirect"),
      ])
    ).toEqual([
      ["r2c2.dev", { site: "site1", status: "live" }],
      ["www.r2c2.dev", { redirect: "https://r2c2.dev" }],
    ])
  })

  it("carries the site's coming-soon status", () => {
    expect(
      routeEntries({ ...site, status: "coming-soon" }, [
        active("r2c2.dev", "primary"),
      ])
    ).toEqual([["r2c2.dev", { site: "site1", status: "coming-soon" }]])
  })

  it("deletes pending domains and redirects with no active primary", () => {
    expect(
      routeEntries(site, [
        { ...active("r2c2.dev", "primary"), status: "pending" },
        active("www.r2c2.dev", "redirect"),
      ])
    ).toEqual([
      ["r2c2.dev", null],
      ["www.r2c2.dev", null],
    ])
  })
})
