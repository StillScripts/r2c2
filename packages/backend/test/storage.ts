/** An in-memory stand-in for `convex/storage`: `vi.mock("./storage", () => import("../test/storage"))`. */
export const writes: { key: string; metadata?: object }[] = []
export const stored = new Map<string, string>()

import { HTML_CONTENT_TYPE } from "@workspace/core"

export async function putObject(
  key: string,
  body: string,
  _type: string,
  metadata?: object
) {
  writes.push({ key, metadata })
  stored.set(key, body)
  return key
}

export const putHtml = (key: string, html: string, metadata?: object) =>
  putObject(key, html, HTML_CONTENT_TYPE, metadata)

export const objectSize = async (key: string) => {
  const body = stored.get(key)
  return body === undefined ? null : new TextEncoder().encode(body).length
}

export const objectExists = async (key: string) => stored.has(key)

export const getObjectText = async (key: string) => stored.get(key)!

export const uploadUrl = async (key: string) => `https://r2.test/${key}`

export function resetStorage() {
  writes.length = 0
  stored.clear()
}
