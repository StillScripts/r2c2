import { describe, expect, it } from "vite-plus/test"
import {
  apiHeaders,
  assetHeaders,
  CSP,
  notFoundHeaders,
  pageHeaders,
} from "./headers"

describe("response headers", () => {
  it("builds page headers with tags, etag and security headers", () => {
    expect(
      pageHeaders({ siteId: "s_r2c2", pageId: "p_home", hash: "abc" })
    ).toEqual({
      "cache-control":
        "public, max-age=0, s-maxage=60, stale-while-revalidate=86400",
      "cache-tag": "site-s_r2c2,page-p_home",
      etag: '"abc"',
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": CSP,
      "strict-transport-security": "max-age=31536000",
      "x-content-type-options": "nosniff",
    })
  })

  it("builds the page CSP from SPEC §5", () => {
    expect(CSP).toBe(
      "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data:; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
    )
  })

  it("caches 404s briefly under the site tag", () => {
    expect(notFoundHeaders("s_r2c2")).toMatchObject({
      "cache-control": "public, max-age=0, s-maxage=60",
      "cache-tag": "site-s_r2c2",
      "x-content-type-options": "nosniff",
    })
  })

  it("caches assets forever and never caches the API", () => {
    expect(assetHeaders()).toEqual({
      "cache-control": "public, max-age=31536000, immutable",
    })
    expect(apiHeaders()).toEqual({ "cache-control": "no-store" })
  })
})
