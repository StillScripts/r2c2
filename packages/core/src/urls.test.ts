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
    expect(parseBuildPath(`/_build/${BUILD}/assets/Index-AbC.js`)).toEqual({
      buildId: BUILD,
      path: "assets/Index-AbC.js",
      contentType: "text/javascript; charset=utf-8",
    })
    expect(parseBuildPath(`/_build/${BUILD}/My%20Level.JSON`)).toEqual({
      buildId: BUILD,
      path: "My Level.JSON",
      contentType: "application/json; charset=utf-8",
    })
  })

  it.each([
    ["outside the prefix", `/assets/${BUILD}.js`],
    ["a malformed build ID", "/_build/ABCDEF0123456789/a.js"],
    ["no file", `/_build/${BUILD}/`],
    ["a parent segment", `/_build/${BUILD}/assets/../secret.js`],
    ["an encoded parent segment", `/_build/${BUILD}/assets/%2e%2e/secret.js`],
    ["an encoded slash escape", `/_build/${BUILD}/..%2Fsecret.js`],
    ["a backslash", `/_build/${BUILD}/assets%5csecret.js`],
    ["an empty segment", `/_build/${BUILD}/assets//a.js`],
    ["bad encoding", `/_build/${BUILD}/%E0%A4%A.js`],
    ["HTML", `/_build/${BUILD}/index.html`],
    ["SVG", `/_build/${BUILD}/logo.svg`],
    ["no extension", `/_build/${BUILD}/assets.js/file`],
  ])("rejects %s", (_, pathname) => {
    expect(parseBuildPath(pathname)).toBeNull()
  })
})
