import { describe, expect, it } from "vite-plus/test"
import { previewDocument } from "./preview"

describe("previewDocument", () => {
  it("adds the CSS to the end of the head", () => {
    expect(
      previewDocument(
        "<html><head><title>x</title></HEAD><body></body></html>",
        "p{}"
      )
    ).toBe(
      "<html><head><title>x</title><style>p{}</style></HEAD><body></body></html>"
    )
  })

  it("adds a head when the document has none", () => {
    expect(previewDocument('<html lang="en"><body></body></html>', "p{}")).toBe(
      '<html lang="en"><head><style>p{}</style></head><body></body></html>'
    )
  })

  it("wraps a fragment in a document", () => {
    expect(previewDocument("<p>hi</p>", "p{}")).toBe(
      "<!doctype html><html><head><style>p{}</style></head><body><p>hi</p></body></html>"
    )
  })
})
