export const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "img-src 'self' data:",
  "style-src 'self'",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ")

export const siteTag = (siteId: string) => `site-${siteId}`
export const pageTag = (pageId: string) => `page-${pageId}`

const htmlHeaders = (cacheControl: string, tags: string[]) => ({
  "cache-control": cacheControl,
  "cache-tag": tags.join(","),
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": CSP,
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
})

export const pageHeaders = (page: {
  siteId: string
  pageId: string
  hash: string
}) => ({
  ...htmlHeaders(
    "public, max-age=0, s-maxage=60, stale-while-revalidate=86400",
    [siteTag(page.siteId), pageTag(page.pageId)]
  ),
  etag: `"${page.hash}"`,
})

export const notFoundHeaders = (siteId: string) =>
  htmlHeaders("public, max-age=0, s-maxage=60", [siteTag(siteId)])

export const comingSoonHeaders = (siteId: string) => ({
  ...htmlHeaders("public, max-age=0, s-maxage=60", [siteTag(siteId)]),
  "x-robots-tag": "noindex",
})

export const ASSET_HEADERS = {
  "cache-control": "public, max-age=31536000, immutable",
}

export const assetHeaders = (contentType: string) => ({
  ...ASSET_HEADERS,
  "content-type": contentType,
  "x-content-type-options": "nosniff",
})

export const API_HEADERS = { "cache-control": "no-store" }
