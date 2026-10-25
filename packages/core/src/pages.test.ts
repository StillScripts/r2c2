import { describe, expect, it } from "vite-plus/test"
import {
  draftTitle,
  MAX_PAGE_PATH_LENGTH,
  pageBytes,
  parsePagePath,
} from "./pages"

describe("parsePagePath", () => {
  it.each([
    ["/", "/"],
    ["/about", "/about"],
    [" /About-Us/ ", "/about-us"],
    ["about", "/about"],
    ["/services/teeth-whitening", "/services/teeth-whitening"],
    ["//team//", "/team"],
  ])("accepts %j as %j", (input, path) => {
    expect(parsePagePath(input)).toBe(path)
  })

  it.each([
    "/about us",
    "/about_us",
    "/-about",
    "/about-",
    "/a/../b",
    "/caf%C3%A9",
    "/%zz",
    `/${"a".repeat(MAX_PAGE_PATH_LENGTH)}`,
  ])("rejects %j", (input) => {
    expect(parsePagePath(input)).toBeNull()
  })
})

describe("draftTitle", () => {
  it("reads the title", () => {
    expect(draftTitle("<head><title> Hello </title></head>")).toBe("Hello")
  })

  it("returns null without a non-empty title", () => {
    expect(draftTitle("<head></head>")).toBeNull()
    expect(draftTitle("<title>  </title>")).toBeNull()
  })
})

describe("pageBytes", () => {
  it("counts UTF-8 bytes", () => {
    expect(pageBytes("é")).toBe(2)
  })
})
