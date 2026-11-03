import { describe, expect, it } from "vite-plus/test"
import { shortWhen } from "./format"

const now = new Date(2026, 10, 3, 9, 30).getTime()

describe("shortWhen", () => {
  it("shows the time today", () => {
    expect(shortWhen(new Date(2026, 10, 3, 6, 2).getTime(), now)).toMatch(
      /^6:02\s?am$/
    )
  })

  it("says yesterday, then the weekday, then the date", () => {
    expect(shortWhen(new Date(2026, 10, 2, 23, 48).getTime(), now)).toBe(
      "Yesterday"
    )
    expect(shortWhen(new Date(2026, 9, 29, 12).getTime(), now)).toBe(
      new Date(2026, 9, 29).toLocaleDateString(undefined, { weekday: "short" })
    )
    expect(shortWhen(new Date(2026, 9, 20, 12).getTime(), now)).toBe(
      new Date(2026, 9, 20).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    )
  })
})
