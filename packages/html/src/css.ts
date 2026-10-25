import { hashContent } from "@workspace/core"
import { classTokens, elements, parse } from "./parse"
import type { Theme } from "./theme"

export async function compileCss(html: string, theme: Theme) {
  const classes = new Set(elements(parse(html)).flatMap(classTokens))
  const css = theme.build([...classes])
  return { css, hash: await hashContent(css) }
}
