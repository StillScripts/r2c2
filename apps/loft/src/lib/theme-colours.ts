const COLOUR = /(?<![\w-])--color-([\w-]+)\s*:([^;}]*)/g
const COMMENT = /\/\*[\s\S]*?\*\//g

export type Colour = { name: string; value: string }

type Declaration = Colour & { start: number; end: number }

// Comments are blanked out rather than removed, so offsets still point into the original CSS
function themeBlock(css: string) {
  const masked = css.replace(COMMENT, (comment) => " ".repeat(comment.length))
  const open = /@theme\b[^{;]*\{/.exec(masked)
  if (!open) return undefined
  const start = open.index + open[0].length
  let depth = 1
  let end = start
  for (; end < masked.length; end++) {
    if (masked[end] === "{") depth++
    else if (masked[end] === "}" && --depth === 0) break
  }
  return { masked, start, end }
}

function declarations(css: string): Declaration[] {
  const block = themeBlock(css)
  if (!block) return []
  const body = block.masked.slice(block.start, block.end)
  return [...body.matchAll(COLOUR)].map((match) => {
    const raw = match[2]!
    const start =
      block.start + match.index + match[0].length - raw.trimStart().length
    const end = start + raw.trim().length
    return { name: match[1]!, value: css.slice(start, end), start, end }
  })
}

function lastDeclarations(css: string) {
  return new Map(
    declarations(css).map((declaration) => [declaration.name, declaration])
  )
}

/** The `--color-*` tokens in the theme's `@theme` block, by name. A repeated name has its last value, as in CSS. */
export function readColours(css: string): Colour[] {
  return [...lastDeclarations(css).values()].map(({ name, value }) => ({
    name,
    value,
  }))
}

/** The theme with the last `--color-<name>` declaration set to `value`. */
export function setColour(css: string, name: string, value: string) {
  const declaration = lastDeclarations(css).get(name)
  if (!declaration) return css
  return css.slice(0, declaration.start) + value + css.slice(declaration.end)
}

/** The theme with `--color-<name>` added at the end of its `@theme` block, which is created if there isn't one. */
export function addColour(css: string, name: string, value: string) {
  const line = `  --color-${name}: ${value};`
  const block = themeBlock(css)
  if (!block) return `@theme {\n${line}\n}\n${css && `\n${css}`}`
  const body = block.masked.slice(block.start, block.end).trimEnd()
  const at = block.start + body.length
  const separator = body.trim() && !/[;{}]$/.test(body) ? ";" : ""
  return `${css.slice(0, at)}${separator}\n${line}${css.slice(at)}`
}

export const isColourName = (name: string) => /^[a-z][a-z0-9-]*$/.test(name)

/** The value as `#rrggbb` for a colour input, or undefined if it isn't a plain hex colour. */
export function hexColour(value: string) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1]
  if (!hex) return undefined
  const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex
  return `#${full.toLowerCase()}`
}
