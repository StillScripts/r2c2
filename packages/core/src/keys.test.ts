import { describe, expect, it } from "vite-plus/test"
import {
  assetKey,
  assetUrl,
  elementsKey,
  elementsUrl,
  liveKey,
  notFoundKey,
  routeKey,
  versionKey,
} from "./keys"

describe("R2 and KV keys", () => {
  it.each([
    ["/", "sites/s_r2c2/live/index.html"],
    ["/about", "sites/s_r2c2/live/about/index.html"],
    ["/about/team", "sites/s_r2c2/live/about/team/index.html"],
  ])("maps live page %s", (path, expected) => {
    expect(liveKey("s_r2c2", path)).toBe(expected)
  })

  it("builds the immutable keys", () => {
    expect(versionKey("s_r2c2", "abc")).toBe("sites/s_r2c2/versions/abc.html")
    expect(assetKey("s_r2c2", "abc", "css")).toBe("sites/s_r2c2/assets/abc.css")
    expect(elementsKey("abc")).toBe("shared/elements/abc.js")
  })

  it("builds the not-found and routing keys", () => {
    expect(notFoundKey("s_r2c2")).toBe("sites/s_r2c2/404.html")
    expect(routeKey("r2c2.dev")).toBe("host:r2c2.dev")
  })

  it("builds the public asset and elements URLs", () => {
    expect(assetUrl("abc", "css")).toBe("/assets/abc.css")
    expect(elementsUrl("abc")).toBe("/_elements/abc.js")
  })
})
