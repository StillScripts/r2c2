import { sha256Hex } from "@workspace/core"
import { classTokens, elements, parse } from "./parse"
import type { Theme } from "./theme"

export const hashContent = async (content: string) =>
  (await sha256Hex(content)).slice(0, 16)

export async function compileCss(html: string, theme: Theme) {
  const classes = new Set([...elements(parse(html))].flatMap(classTokens))
  const css = theme.build([...classes])
  return { css, hash: await hashContent(css) }
}
