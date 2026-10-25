import { describe, expect, it } from "vite-plus/test"
import { safeRedirect } from "./redirect"

describe("safeRedirect", () => {
  it.each(["/", "/sites", "/sites?tab=pages#top"])("keeps %s", (path) => {
    expect(safeRedirect(path)).toBe(path)
  })

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "sites",
    "",
    undefined,
    42,
  ])("falls back to / for %s", (target) => {
    expect(safeRedirect(target)).toBe("/")
  })
})
