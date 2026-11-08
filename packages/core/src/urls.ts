import { HASH_LENGTH } from "./hash"
import { pathSegments } from "./paths"

export const ASSETS_PREFIX = "/assets/"
export const ELEMENTS_PREFIX = "/_elements/"
/** App build files, served under their own names and case (ADR-020, ADR-021). */
export const BUILD_PREFIX = "/_build/"

/** File types the edge serves as assets. SVG is left out: it can carry script. */
export const ASSET_CONTENT_TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  webp: "image/webp",
  avif: "image/avif",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  ico: "image/x-icon",
  woff2: "font/woff2",
}

/**
 * File types an app build may contain besides its root `index.html`. Build files are
 * served without the page security policy, so HTML and SVG stay out.
 */
export const BUILD_CONTENT_TYPES: Record<string, string> = {
  ...ASSET_CONTENT_TYPES,
  json: "application/json; charset=utf-8",
}

const typeOf = (types: Record<string, string>, ext: string | undefined) =>
  ext && Object.hasOwn(types, ext) ? types[ext] : undefined

const HEX_ID = `[0-9a-f]{${HASH_LENGTH}}`
const HASHED_NAME = new RegExp(`^(${HEX_ID})\\.([a-z0-9]+)$`)
const BUILD_ID = new RegExp(`^${HEX_ID}$`)

/** Split a `<hash>.<ext>` file name, or return null if it isn't one we serve. */
export function parseAssetName(name: string) {
  const [, hash, ext] = name.match(HASHED_NAME) ?? []
  const contentType = typeOf(ASSET_CONTENT_TYPES, ext)
  return hash && ext && contentType ? { hash, ext, contentType } : null
}

/**
 * Split the `<buildId>/<path>` after `/_build/`, decoding it but keeping its case, or
 * return null if it isn't a build file we serve.
 */
export function parseBuildPath(rest: string) {
  const [buildId = "", ...segments] = pathSegments(rest) ?? []
  if (!BUILD_ID.test(buildId) || !segments.length || segments.includes("")) {
    return null
  }

  const ext = /\.([^.]+)$/.exec(segments.at(-1)!)?.[1]?.toLowerCase()
  const contentType = typeOf(BUILD_CONTENT_TYPES, ext)
  return contentType ? { buildId, path: segments.join("/"), contentType } : null
}

/**
 * Custom metadata publish writes on every live page copy. Keys are single lowercase
 * words because S3-style `x-amz-meta-*` headers don't keep their case.
 */
export type LivePageMetadata = { page: string; hash: string }
