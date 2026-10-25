import { describe, expect, it } from "vite-plus/test"
import { compileCss } from "./css"
import { THEME } from "./fixtures"
import { loadTheme } from "./theme"

const theme = await loadTheme(THEME)

describe("loadTheme", () => {
  it("reads theme colours and component classes", () => {
    expect(theme.colours).toEqual(["brand", "ink", "paper"])
    expect([...theme.components]).toEqual(["btn", "card", "section", "prose"])
  })

  it("only accepts classes the theme can compile", () => {
    const classes = [
      "bg-brand",
      "md:hover:text-ink",
      "font-sans",
      "rounded-card",
      "btn",
      "p-4",
      "bg-red-500",
      "font-serif",
      "rounded-lg",
      "shadow-md",
      "js-toggle",
    ]
    expect(theme.invalidClasses(classes)).toEqual([
      "bg-red-500",
      "font-serif",
      "rounded-lg",
      "shadow-md",
      "js-toggle",
    ])
  })
})

describe("compileCss", () => {
  it("compiles the page's classes with a stable hash", async () => {
    const html = '<p class="bg-brand btn">x</p>'
    const first = await compileCss(html, theme)
    expect(first.css).toContain(".bg-brand")
    expect(first.css).toContain(".btn")
    expect(first.css).not.toContain("--color-red")
    expect(first.hash).toMatch(/^[0-9a-f]{16}$/)
    expect((await compileCss(html, theme)).hash).toBe(first.hash)
  })
})

describe("loadTheme imports and failures", () => {
  it("resolves tailwindcss subpath imports", async () => {
    const theme = await loadTheme(`@import "tailwindcss/theme.css";\n${THEME}`)
    expect(theme.build(["text-ink"])).toContain(".text-ink")
  })

  it("doesn't cache a theme that failed to build", async () => {
    const css = `@import "missing-stylesheet.css";`
    const first = loadTheme(css)
    await expect(first).rejects.toThrow()
    const second = loadTheme(css)
    expect(second).not.toBe(first)
    await expect(second).rejects.toThrow()
  })
})
