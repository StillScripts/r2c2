import { byTag, elements, parse, serialise } from "./parse"

export const ID_ATTRIBUTE = "data-r2c2-id"

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"

const randomId = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (byte) => ALPHABET[byte % ALPHABET.length]
  ).join("")

export function assignElementIds(html: string, newId = randomId): string {
  const doc = parse(html)
  const seen = new Set<string>()
  for (const element of elements(byTag("body", doc)[0] ?? doc)) {
    let id = element.attribs[ID_ATTRIBUTE]
    while (!id || seen.has(id)) id = newId()
    element.attribs[ID_ATTRIBUTE] = id
    seen.add(id)
  }
  return serialise(doc)
}
