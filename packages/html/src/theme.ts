import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { __unstable__loadDesignSystem, compile } from "tailwindcss"

const require = createRequire(import.meta.url)

const RESET = `@theme {
  --color-*: initial;
  --font-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
}`

async function loadStylesheet(id: string, base: string) {
  const file =
    id === "tailwindcss"
      ? require.resolve("tailwindcss/index.css")
      : require.resolve(id, { paths: [base] })
  return {
    path: file,
    base: path.dirname(file),
    content: await readFile(file, "utf8"),
  }
}

const names = (css: string, pattern: RegExp) =>
  [...css.matchAll(pattern)].map((match) => match[1]!)

export type Theme = Awaited<ReturnType<typeof loadTheme>>

export async function loadTheme(themeCss: string) {
  const css = `@import "tailwindcss";\n${RESET}\n${themeCss}`
  const options = { base: process.cwd(), loadStylesheet }
  const [designSystem, compiler] = await Promise.all([
    __unstable__loadDesignSystem(css, options),
    compile(css, options),
  ])
  return {
    colours: names(themeCss, /--color-([\w-]+)\s*:/g),
    components: new Set(names(themeCss, /@utility\s+([\w-]+)/g)),
    invalidClasses: (classes: string[]) => {
      const results = designSystem.candidatesToCss(classes)
      return classes.filter((_, i) => results[i] === null)
    },
    build: (classes: string[]) => compiler.build(classes),
  }
}
