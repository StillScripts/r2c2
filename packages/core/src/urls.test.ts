import { describe, expect, it } from "vite-plus/test"
import { hashContent } from "./hash"
import { parseAssetName, parseBuildPath } from "./urls"

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

describe("parseBuildPath", () => {
  const BUILD = "0123456789abcdef"

  it("keeps the path's case and decodes it", () => {
    expect(parseBuildPath(`${BUILD}/assets/Index-AbC.js`)).toEqual({
      buildId: BUILD,
      path: "assets/Index-AbC.js",
      contentType: "text/javascript; charset=utf-8",
    })
    expect(parseBuildPath(`${BUILD}/My%20Level.JSON`)).toEqual({
      buildId: BUILD,
      path: "My Level.JSON",
      contentType: "application/json; charset=utf-8",
    })
  })

  it.each([
    ["a malformed build ID", "ABCDEF0123456789/a.js"],
    ["no file", `${BUILD}/`],
    ["a parent segment", `${BUILD}/assets/../secret.js`],
    ["an encoded parent segment", `${BUILD}/assets/%2e%2e/secret.js`],
    ["an encoded slash escape", `${BUILD}/..%2Fsecret.js`],
    ["a backslash", `${BUILD}/assets%5csecret.js`],
    ["an empty segment", `${BUILD}/assets//a.js`],
    ["bad encoding", `${BUILD}/%E0%A4%A.js`],
    ["HTML", `${BUILD}/index.html`],
    ["SVG", `${BUILD}/logo.svg`],
    ["no extension", `${BUILD}/assets.js/file`],
  ])("rejects %s", (_, rest) => {
    expect(parseBuildPath(rest)).toBeNull()
  })
})
