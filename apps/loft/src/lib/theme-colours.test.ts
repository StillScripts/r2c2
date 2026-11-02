import { readFileSync } from "node:fs"
import { describe, expect, it } from "vite-plus/test"
import {
  addColour,
  hexColour,
  isColourName,
  readColours,
  setColour,
} from "./theme-colours"

const THEME = `/* --color-ignored: red; */
@import "x.css";
@theme {
  --color-*: initial;
  --color-brand: #2f3bff;
  --color-soft: oklch(0.9 0.05 260) /* tint */;
  --font-sans: Archivo;
}
@utility btn { --color-local: blue; }`

describe("readColours", () => {
  it("reads the colour tokens in the @theme block", () => {
    expect(readColours(THEME)).toEqual([
      { name: "brand", value: "#2f3bff" },
      { name: "soft", value: "oklch(0.9 0.05 260)" },
    ])
  })

  it("reads the marketing site's theme", () => {
    const css = readFileSync(
      new URL("../../../../sites/r2c2/theme.css", import.meta.url),
      "utf8"
    )
    const colours = readColours(css)
    expect(colours).toContainEqual({ name: "brand", value: "#2f3bff" })
    expect(colours).toContainEqual({ name: "night-text", value: "#e9ecf2" })
  })

  it("uses the last value of a repeated token", () => {
    expect(
      readColours(
        "@theme { --color-a: red; --color-b: blue; --color-a: green }"
      )
    ).toEqual([
      { name: "a", value: "green" },
      { name: "b", value: "blue" },
    ])
  })

  it("finds nothing in an empty theme or one without @theme", () => {
    expect(readColours("")).toEqual([])
    expect(readColours("@utility btn { --color-x: red; }")).toEqual([])
  })
})

describe("setColour", () => {
  it("replaces only the token's value", () => {
    expect(setColour(THEME, "soft", "#ecedff")).toBe(
      THEME.replace("oklch(0.9 0.05 260)", "#ecedff")
    )
  })

  it("sets the last declaration of a repeated token", () => {
    expect(setColour("@theme{--color-a:red;--color-a:blue}", "a", "#fff")).toBe(
      "@theme{--color-a:red;--color-a:#fff}"
    )
  })

  it("leaves the theme alone for an unknown token", () => {
    expect(setColour(THEME, "missing", "#fff")).toBe(THEME)
  })
})

describe("addColour", () => {
  it("adds the token at the end of the @theme block", () => {
    expect(addColour(THEME, "accent", "#ff0000")).toBe(
      THEME.replace(
        "--font-sans: Archivo;\n}",
        "--font-sans: Archivo;\n  --color-accent: #ff0000;\n}"
      )
    )
  })

  it("ends an unterminated last declaration first", () => {
    expect(addColour("@theme { --color-a: red }", "b", "blue")).toBe(
      "@theme { --color-a: red;\n  --color-b: blue; }"
    )
  })

  it("adds to an empty @theme block", () => {
    expect(readColours(addColour("@theme {}", "a", "red"))).toEqual([
      { name: "a", value: "red" },
    ])
  })

  it("creates a @theme block when there isn't one", () => {
    expect(addColour("", "a", "red")).toBe("@theme {\n  --color-a: red;\n}\n")
    expect(addColour("@utility btn {}", "a", "red")).toBe(
      "@theme {\n  --color-a: red;\n}\n\n@utility btn {}"
    )
  })
})

describe("hexColour", () => {
  it("normalises hex colours for a colour input", () => {
    expect(hexColour("#2F3BFF")).toBe("#2f3bff")
    expect(hexColour("#abc")).toBe("#aabbcc")
  })

  it("rejects anything else", () => {
    for (const value of ["oklch(0.9 0 0)", "#abcd", "red", "var(--x)"]) {
      expect(hexColour(value)).toBeUndefined()
    }
  })
})

describe("isColourName", () => {
  it("accepts kebab-case names", () => {
    expect(isColourName("brand-soft")).toBe(true)
    expect(isColourName("Brand")).toBe(false)
    expect(isColourName("1x")).toBe(false)
    expect(isColourName("")).toBe(false)
  })
})
