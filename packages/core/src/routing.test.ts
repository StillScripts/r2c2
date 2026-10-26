import { describe, expect, it } from "vite-plus/test"
import { redirectLocation, routeEntries, routeEntrySchema } from "./routing"

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
    { redirect: "https://r2c2.dev/about" },
    {},
  ])("rejects %j", (entry) => {
    expect(routeEntrySchema.safeParse(entry).success).toBe(false)
  })
})

const site = { id: "site1", status: "live" as const }
const active = (
  hostname: string,
  kind: "primary" | "redirect" | "address"
) => ({
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

describe("routeEntries with a site address", () => {
  it("serves the site on its address until it has a custom primary", () => {
    expect(
      routeEntries(site, [
        active("a.lofty.page", "address"),
        active("www.a.dev", "redirect"),
      ])
    ).toEqual([
      ["a.lofty.page", { site: "site1", status: "live" }],
      ["www.a.dev", { redirect: "https://a.lofty.page" }],
    ])
  })

  it("redirects the address to an active custom primary", () => {
    expect(
      routeEntries(site, [
        active("a.lofty.page", "address"),
        active("a.dev", "primary"),
      ])
    ).toEqual([
      ["a.lofty.page", { redirect: "https://a.dev" }],
      ["a.dev", { site: "site1", status: "live" }],
    ])
  })

  it("keeps serving the address while the custom primary is pending", () => {
    expect(
      routeEntries(site, [
        active("a.lofty.page", "address"),
        { ...active("a.dev", "primary"), status: "pending" },
      ])
    ).toEqual([
      ["a.lofty.page", { site: "site1", status: "live" }],
      ["a.dev", null],
    ])
  })
})

describe("redirectLocation", () => {
  it("keeps the path and query on the target origin", () => {
    expect(
      redirectLocation(
        "https://a.test",
        new URL("https://www.a.test/About?x=1")
      )
    ).toBe("https://a.test/About?x=1")
  })

  it("never leaves the target origin for a protocol-relative path", () => {
    const location = redirectLocation(
      "https://a.test",
      new URL("https://www.a.test//evil.test/x")
    )
    expect(new URL(location).host).toBe("a.test")
  })
})
