import { describe, expect, it } from "vite-plus/test"
import { buildAppShell } from "./app-shell"

const options = {
  base: "/_build/0123456789abcdef/",
  files: new Set([
    "index.html",
    "assets/index-AbC.js",
    "assets/index-Dx9.css",
    "favicon.ico",
    "hero.webp",
    "hero@2x.webp",
  ]),
}

const shell = (head: string, body = "") =>
  `<!doctype html><html lang="en"><head>${head}</head><body>${body}</body></html>`

const VITE_HEAD = `<link rel="icon" href="./favicon.ico"><script type="module" crossorigin src="./assets/index-AbC.js"></script><link rel="stylesheet" crossorigin href="./assets/index-Dx9.css">`

const rules = (html: string) => {
  const result = buildAppShell(html, options)
  if (result.ok) throw new Error("expected the shell to be refused")
  return result.errors.map((error) => error.rule)
}

describe("buildAppShell", () => {
  it("points a relative-base Vite shell at the build", () => {
    const result = buildAppShell(
      shell(VITE_HEAD, `<div id="app"></div>`),
      options
    )
    expect(result).toEqual({
      ok: true,
      html: shell(
        `<link rel="icon" href="/_build/0123456789abcdef/favicon.ico"><script type="module" crossorigin src="/_build/0123456789abcdef/assets/index-AbC.js"></script><link rel="stylesheet" crossorigin href="/_build/0123456789abcdef/assets/index-Dx9.css">`,
        `<div id="app"></div>`
      ),
    })
  })

  it("rewrites paths without ./, srcset candidates, and keeps queries", () => {
    const result = buildAppShell(
      shell(
        "",
        `<img alt="" src="hero.webp?v=2" srcset="./hero.webp 1x, hero@2x.webp 2x"><a href="./about">About</a><a href="#top">Top</a>`
      ),
      options
    )
    expect(result.ok && result.html).toContain(
      `src="/_build/0123456789abcdef/hero.webp?v=2" srcset="/_build/0123456789abcdef/hero.webp 1x, /_build/0123456789abcdef/hero@2x.webp 2x"><a href="./about">About</a><a href="#top">`
    )
  })

  it("refuses inline scripts, styles, handlers and style attributes", () => {
    expect(
      rules(
        shell(
          `<script>alert(1)</script><script src="./assets/index-AbC.js">x()</script><style>p{}</style>`,
          `<p onclick="x()" style="color:red">Hi</p>`
        )
      )
    ).toEqual([
      "inline-script",
      "inline-script",
      "inline-style",
      "inline-handler",
      "style-attribute",
    ])
  })

  it("refuses other origins, absolute paths, <base> and missing files", () => {
    expect(
      rules(
        shell(
          `<base href="/"><script src="https://cdn.example/x.js"></script><link rel="stylesheet" href="//fonts.example/a.css"><script type="module" src="/assets/index-AbC.js"></script>`,
          `<img alt="" src="./missing.webp">`
        )
      )
    ).toEqual([
      "no-base",
      "absolute-url",
      "third-party-url",
      "third-party-url",
      "absolute-url",
      "missing-file",
    ])
  })

  it("gives each problem its line", () => {
    const result = buildAppShell(
      `<!doctype html>\n<html>\n<body><p style="x">Hi</p></body></html>`,
      options
    )
    expect(!result.ok && result.errors[0]).toMatchObject({
      line: 3,
      rule: "style-attribute",
    })
  })
})
