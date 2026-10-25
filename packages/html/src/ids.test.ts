import { describe, expect, it } from "vite-plus/test"
import { assignElementIds } from "./ids"

const counter = () => {
  let n = 0
  return () => `id${n++}`
}

describe("assignElementIds", () => {
  it("gives every body element an id and leaves the document shell alone", () => {
    expect(
      assignElementIds(
        "<html><head><title>T</title></head><body><p>Hi <a>x</a></p></body></html>",
        counter()
      )
    ).toBe(
      '<html><head><title>T</title></head><body><p data-r2c2-id="id0">Hi <a data-r2c2-id="id1">x</a></p></body></html>'
    )
  })

  it("keeps existing ids through text edits and reordering", () => {
    const html =
      '<p data-r2c2-id="b">Second</p><p data-r2c2-id="a">First, edited</p><p>New</p>'
    expect(assignElementIds(html, counter())).toBe(
      '<p data-r2c2-id="b">Second</p><p data-r2c2-id="a">First, edited</p><p data-r2c2-id="id0">New</p>'
    )
  })

  it("re-ids later copies of a duplicated id", () => {
    expect(
      assignElementIds(
        '<p data-r2c2-id="a">One</p><p data-r2c2-id="a">Copy</p>',
        counter()
      )
    ).toBe('<p data-r2c2-id="a">One</p><p data-r2c2-id="id0">Copy</p>')
  })

  it("never hands out an id that is already taken", () => {
    const ids = ["a", "a", "b"].values()
    expect(
      assignElementIds(
        '<p data-r2c2-id="a"></p><p></p>',
        () => ids.next().value!
      )
    ).toBe('<p data-r2c2-id="a"></p><p data-r2c2-id="b"></p>')
  })

  it("is idempotent", () => {
    const once = assignElementIds("<div><p>Café &amp; co</p></div>")
    expect(assignElementIds(once)).toBe(once)
  })

  it("generates 8-character base36 ids by default", () => {
    expect(assignElementIds("<p></p>")).toMatch(
      /^<p data-r2c2-id="[0-9a-z]{8}"><\/p>$/
    )
  })
})
