import { describe, expect, it } from "vite-plus/test"
import { normaliseHost, normalisePath, stripTrackingParams } from "./paths"

describe("normaliseHost", () => {
  it.each([
    ["r2c2.dev", "r2c2.dev"],
    ["R2C2.Dev", "r2c2.dev"],
    ["r2c2.dev:8787", "r2c2.dev"],
    ["r2c2.dev.", "r2c2.dev"],
    ["WWW.R2C2.DEV.:443", "www.r2c2.dev"],
    ["[::1]:8787", "[::1]"],
  ])("normalises %s to %s", (host, expected) => {
    expect(normaliseHost(host)).toBe(expected)
  })

  it.each([
    "",
    "evil.com@r2c2.dev",
    "r2c2.dev/path",
    "r2c2 .dev",
    "a?b",
    "a#b",
  ])("rejects %j", (host) => {
    expect(normaliseHost(host)).toBeNull()
  })
})

describe("normalisePath", () => {
  it.each([
    ["/", "/"],
    ["", "/"],
    ["/about", "/about"],
    ["/about/", "/about"],
    ["/About/Team", "/about/team"],
    ["//about//team//", "/about/team"],
    ["/caf%C3%A9", "/café"],
  ])("normalises %j to %j", (path, expected) => {
    expect(normalisePath(path)).toBe(expected)
  })

  it.each([
    "/..",
    "/about/../secret",
    "/%2e%2e/secret",
    "/./about",
    "/about%5c..%5csecret",
    "/about%00",
    "/%E0%A4%A",
  ])("rejects %j", (path) => {
    expect(normalisePath(path)).toBeNull()
  })
})

describe("stripTrackingParams", () => {
  it("drops utm_*, gclid and fbclid and keeps the rest", () => {
    const url = new URL(
      "https://r2c2.dev/about?utm_source=x&utm_medium=y&gclid=1&fbclid=2&page=3"
    )
    expect(stripTrackingParams(url).toString()).toBe(
      "https://r2c2.dev/about?page=3"
    )
  })

  it("removes the query string when only tracking params remain", () => {
    const url = new URL("https://r2c2.dev/?utm_campaign=launch")
    expect(stripTrackingParams(url).toString()).toBe("https://r2c2.dev/")
  })

  it("leaves the original URL untouched", () => {
    const url = new URL("https://r2c2.dev/?gclid=1")
    stripTrackingParams(url)
    expect(url.search).toBe("?gclid=1")
  })
})
