import { readdir, readFile } from "node:fs/promises"
import { describe, expect, it } from "vite-plus/test"
import { checkPage } from "./check"
import { loadTheme } from "./theme"

const SITES = new URL("../../../sites/", import.meta.url)

const read = (site: string, file: string) =>
  readFile(new URL(`${site}/${file}`, SITES), "utf8")

const sites = await Promise.all(
  (await readdir(SITES, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map(async ({ name }) => ({
      name,
      theme: await loadTheme(await read(name, "theme.css")),
      pages: (await readdir(new URL(`${name}/`, SITES))).filter((file) =>
        file.endsWith(".html")
      ),
    }))
)

describe.each(sites)("sites/$name", ({ name, theme, pages }) => {
  it.each(pages)("%s passes the house rules without warnings", async (file) => {
    const { errors, warnings } = await checkPage(await read(name, file), theme)
    expect({ errors, warnings }).toEqual({ errors: [], warnings: [] })
  })
})

it("the r2c2 home page takes enquiries through its contact form", async () => {
  const theme = sites.find((site) => site.name === "r2c2")!.theme
  const { forms } = await checkPage(await read("r2c2", "index.html"), theme)
  expect(forms.map((form) => form.name)).toEqual(["contact"])
})
