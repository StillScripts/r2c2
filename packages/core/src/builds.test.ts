import { describe, expect, it } from "vite-plus/test"
import {
  type BuildFile,
  buildContentType,
  buildFileProblems,
  buildIdOf,
  MAX_BUILD_BYTES,
  MAX_BUILD_FILE_BYTES,
} from "./builds"
import { parseBuildPath } from "./urls"

const HASH = "a".repeat(64)
const file = (path: string, bytes = 10): BuildFile => ({
  path,
  bytes,
  hash: HASH,
})
const SHELL = file("index.html")

describe("buildFileProblems", () => {
  it("accepts a Vite build", () => {
    expect(
      buildFileProblems([
        SHELL,
        file("assets/index-AbC_12.js"),
        file("assets/index-Dx9.css"),
        file("assets/Logo@2x.webp"),
        file("data/levels.json"),
      ])
    ).toEqual([])
  })

  it("needs a root index.html", () => {
    expect(buildFileProblems([file("app/index.html")])).toEqual([
      expect.stringContaining('"app/index.html" has a file type'),
      "A build needs an index.html at its root.",
    ])
  })

  it.each([
    "../secret.js",
    "./app.js",
    "/app.js",
    "assets//app.js",
    "assets/",
    "a b.js",
    "a%2e.js",
    "a\\b.js",
  ])("refuses the path %j", (path) => {
    expect(buildFileProblems([SHELL, file(path)])).toEqual([
      expect.stringContaining("isn't a relative path"),
    ])
  })

  it.each(["logo.svg", "about.html", "app.mjs", "README"])(
    "refuses %s",
    (path) => {
      expect(buildFileProblems([SHELL, file(path)])).toEqual([
        expect.stringContaining("has a file type builds can't hold"),
      ])
    }
  )

  it("refuses duplicates, bad sizes and bad hashes", () => {
    expect(
      buildFileProblems([
        SHELL,
        file("index.html"),
        file("a.js", -1),
        file("b.js", MAX_BUILD_FILE_BYTES + 1),
        { path: "c.js", bytes: 1, hash: "ABC" },
      ])
    ).toEqual([
      '"index.html" is listed twice.',
      '"a.js" has an invalid size.',
      '"b.js" is over 10 MB.',
      '"c.js" needs its SHA-256 as 64 lowercase hex digits.',
    ])
  })

  it("caps the whole build at 50 MB", () => {
    const big = Array.from({ length: 6 }, (_, i) =>
      file(`${i}.js`, MAX_BUILD_FILE_BYTES)
    )
    expect(buildFileProblems([SHELL, ...big])).toEqual([
      `The build is over ${MAX_BUILD_BYTES / 1024 / 1024} MB.`,
    ])
  })

  it("only accepts paths the edge serves unchanged", () => {
    const path = "assets/Index-AbC_1.2@x+y~z.js"
    expect(buildFileProblems([SHELL, file(path)])).toEqual([])
    expect(parseBuildPath(`0123456789abcdef/${path}`)?.path).toBe(path)
  })
})

describe("buildContentType", () => {
  it("types the shell as HTML and other files by extension", () => {
    expect(buildContentType("index.html")).toMatch(/^text\/html/)
    expect(buildContentType("assets/A.JS")).toMatch(/^text\/javascript/)
    expect(buildContentType("assets/index.html")).toBeUndefined()
  })
})

describe("buildIdOf", () => {
  it("is 16 hex characters that ignore the files' order", async () => {
    const files = [SHELL, { ...file("a.js"), hash: "b".repeat(64) }]
    const id = await buildIdOf(files)
    expect(id).toMatch(/^[0-9a-f]{16}$/)
    expect(await buildIdOf([...files].reverse())).toBe(id)
  })

  it("changes when a file's contents or path change", async () => {
    const id = await buildIdOf([SHELL])
    expect(await buildIdOf([{ ...SHELL, hash: "c".repeat(64) }])).not.toBe(id)
    expect(await buildIdOf([SHELL, file("a.js")])).not.toBe(id)
  })
})
