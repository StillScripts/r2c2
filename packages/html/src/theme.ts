import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { __unstable__loadDesignSystem, compile } from "tailwindcss"

const require = createRequire(import.meta.url)

const isTailwind = (id: string) =>
  id === "tailwindcss" || id.startsWith("tailwindcss/")

async function loadStylesheet(id: string, base: string) {
  const file = isTailwind(id)
    ? // Convex installs external packages outside the module tree, where only
      // the ESM resolver can find them
      fileURLToPath(
        import.meta.resolve(id === "tailwindcss" ? "tailwindcss/index.css" : id)
      )
    : require.resolve(id, { paths: [base] })
  return {
    path: file,
    base: path.dirname(file),
    content: await readFile(file, "utf8"),
  }
}

const names = (css: string, pattern: RegExp) =>
  [...css.matchAll(pattern)].map((match) => match[1]!)

// A site's theme sits on top of Tailwind's defaults, so an empty theme is plain Tailwind.
// A theme that wants only its own tokens starts with `--color-*: initial;` and friends.
async function buildTheme(themeCss: string) {
  const css = `@import "tailwindcss";\n${themeCss}`
  const options = { base: process.cwd(), loadStylesheet }
  const [designSystem, compiler] = await Promise.all([
    __unstable__loadDesignSystem(css, options),
    compile(css, options),
  ])
  return {
    components: new Set(names(themeCss, /@utility\s+([\w-]+)/g)),
    invalidClasses: (classes: string[]) => {
      const results = designSystem.candidatesToCss(classes)
      return classes.filter((_, i) => results[i] === null)
    },
    build: (classes: string[]) => compiler.build(classes),
  }
}

export type Theme = Awaited<ReturnType<typeof buildTheme>>

const themes = new Map<string, Promise<Theme>>()

export function loadTheme(themeCss: string): Promise<Theme> {
  let theme = themes.get(themeCss)
  if (!theme) {
    theme = buildTheme(themeCss)
    themes.set(themeCss, theme)
    // A failed build isn't cached, so the next call tries again
    theme.catch(() => themes.delete(themeCss))
  }
  return theme
}
