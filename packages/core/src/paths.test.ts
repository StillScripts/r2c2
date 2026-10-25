import { describe, expect, it } from "vite-plus/test"
import { normaliseHost, normalisePath, parseHostname } from "./paths"

describe("normaliseHost", () => {
  it.each([
    ["https://r2c2.dev/", "r2c2.dev"],
    ["https://R2C2.Dev/", "r2c2.dev"],
    ["http://r2c2.dev:8787/", "r2c2.dev"],
    ["https://r2c2.dev./", "r2c2.dev"],
    ["https://WWW.R2C2.DEV.:443/about", "www.r2c2.dev"],
    ["https://bücher.example/", "xn--bcher-kva.example"],
  ])("normalises %s to %s", (url, expected) => {
    expect(normaliseHost(new URL(url))).toBe(expected)
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

describe("parseHostname", () => {
  it.each([
    ["R2C2.dev", "r2c2.dev"],
    ["  www.r2c2.dev.  ", "www.r2c2.dev"],
    ["r2c2.dev:8787", "r2c2.dev"],
    ["r2c2.localhost", "r2c2.localhost"],
    ["bücher.example", "xn--bcher-kva.example"],
    ["пример.рф", "xn--e1afmkfd.xn--p1ai"],
  ])("normalises %j", (input, expected) => {
    expect(parseHostname(input)).toBe(expected)
  })

  it.each([
    "",
    "localhost",
    "r2c2.dev/about",
    "user@r2c2.dev",
    "r2c2.dev?x=1",
    "https://r2c2.dev",
    "1.2.3.4",
    "-bad.dev",
    "two words.dev",
  ])("rejects %j", (input) => {
    expect(parseHostname(input)).toBeNull()
  })
})
