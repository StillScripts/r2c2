import { ConvexError } from "convex/values"
import { describe, expect, it } from "vite-plus/test"
import { errorMessage } from "./errors"

describe("errorMessage", () => {
  it("maps a code to its message", () => {
    expect(errorMessage(new ConvexError({ code: "path_taken" }))).toBe(
      "This site already has a page at that path."
    )
  })

  it("names the form in a form conflict", () => {
    expect(
      errorMessage(new ConvexError({ code: "form_conflict", form: "contact" }))
    ).toBe(
      'Another live page has a form named "contact" with different fields. Make them match, or rename one.'
    )
  })

  it.each([
    new ConvexError({ code: "unauthenticated" }),
    new ConvexError("plain"),
    new Error("boom"),
    undefined,
  ])("falls back for %s", (error) => {
    expect(errorMessage(error)).toBe("Something went wrong. Please try again.")
  })
})
