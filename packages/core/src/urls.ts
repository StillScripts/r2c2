import { HASH_LENGTH } from "./hash"

export const ASSETS_PREFIX = "/assets/"
export const ELEMENTS_PREFIX = "/_elements/"

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

const HASHED_NAME = new RegExp(`^([0-9a-f]{${HASH_LENGTH}})\\.([a-z0-9]+)$`)

/** Split a `<hash>.<ext>` file name, or return null if it isn't one we serve. */
export function parseAssetName(name: string) {
  const [, hash, ext] = name.match(HASHED_NAME) ?? []
  const contentType = ext && ASSET_CONTENT_TYPES[ext]
  return hash && ext && contentType ? { hash, ext, contentType } : null
}

/**
 * Custom metadata publish writes on every live page copy. Keys are single lowercase
 * words because S3-style `x-amz-meta-*` headers don't keep their case.
 */
export type LivePageMetadata = { page: string; hash: string }
