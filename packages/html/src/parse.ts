import render from "dom-serializer"
import { type AnyNode, type Document, type Element, isTag } from "domhandler"
import { parseDocument } from "htmlparser2"

export const parse = (html: string) =>
  parseDocument(html, { withStartIndices: true })

export const serialise = (doc: Document) =>
  render(doc, { encodeEntities: "utf8" })

export function* elements(node: AnyNode): Generator<Element> {
  if (isTag(node)) yield node
  if ("children" in node) {
    for (const child of node.children) yield* elements(child)
  }
}

export const classTokens = (element: Element) =>
  element.attribs.class?.split(/\s+/).filter(Boolean) ?? []

export function locator(html: string) {
  const lineStarts = [0]
  for (let i = 0; i < html.length; i++) {
    if (html[i] === "\n") lineStarts.push(i + 1)
  }
  return (index: number) => {
    const line = lineStarts.findLastIndex((start) => start <= index)
    return { line: line + 1, column: index - lineStarts[line]! + 1 }
  }
}
