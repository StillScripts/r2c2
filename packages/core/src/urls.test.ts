import { describe, expect, it } from "vite-plus/test"
import { hashContent } from "./hash"
import { parseAssetName } from "./urls"

describe("parseAssetName", () => {
  it("splits a hashed name from hashContent", async () => {
    const hash = await hashContent("body {}")
    expect(parseAssetName(`${hash}.css`)).toEqual({
      hash,
      ext: "css",
      contentType: "text/css; charset=utf-8",
    })
  })

  it.each([
    "not-a-hash.css",
    "0123456789abcdef.svg",
    "0123456789abcdef.constructor",
    "0123456789abcdef",
    "0123456789ABCDEF.css",
  ])("rejects %s", (name) => {
    expect(parseAssetName(name)).toBeNull()
  })
})
