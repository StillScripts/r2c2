import { normalisePath } from "./paths"

export const MAX_PAGE_BYTES = 500 * 1024
export const MAX_PAGE_PATH_LENGTH = 200

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const encoder = new TextEncoder()

export const pageBytes = (html: string) => encoder.encode(html).length

/** Normalise a typed-in page path, or return null if it isn't `/` or kebab-case segments. */
export function parsePagePath(input: string): string | null {
  const path = normalisePath(input.trim())
  if (!path || path.length > MAX_PAGE_PATH_LENGTH) return null
  return path
    .split("/")
    .slice(1)
    .every((s) => s === "" || SEGMENT.test(s))
    ? path
    : null
}

/** The text of the draft's `<title>`, or null when it has none. */
export function draftTitle(html: string): string | null {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim()
  return title || null
}
