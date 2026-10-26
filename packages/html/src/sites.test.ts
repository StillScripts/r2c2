import { readdir, readFile } from "node:fs/promises"
import { describe, expect, it } from "vite-plus/test"
import { checkPage } from "./check"
import { loadTheme } from "./theme"

const SITES = new URL("../../../sites/", import.meta.url)

const read = (site: string, file: string) =>
  readFile(new URL(`${site}/${file}`, SITES), "utf8")

// Only list files here, so a site that's missing its theme fails its own tests
const sites = await Promise.all(
  (await readdir(SITES, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map(async ({ name }) => ({
      name,
      pages: (await readdir(new URL(`${name}/`, SITES))).filter((file) =>
        file.endsWith(".html")
      ),
    }))
)

// loadTheme caches by CSS, so each site's theme only compiles once
const themeOf = async (site: string) => loadTheme(await read(site, "theme.css"))

describe.each(sites)("sites/$name", ({ name, pages }) => {
  it("has a theme that compiles", async () => {
    await expect(themeOf(name)).resolves.toBeDefined()
  })

  it.each(pages)("%s passes the house rules without warnings", async (file) => {
    const theme = await themeOf(name)
    const { errors, warnings } = await checkPage(await read(name, file), theme)
    expect({ errors, warnings }).toEqual({ errors: [], warnings: [] })
  })
})

it("the r2c2 home page takes enquiries through its contact form", async () => {
  const theme = await themeOf("r2c2")
  const { forms } = await checkPage(await read("r2c2", "index.html"), theme)
  expect(forms.map((form) => form.name)).toEqual(["contact"])
})
