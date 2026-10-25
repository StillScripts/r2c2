import { readdir, readFile } from "node:fs/promises"
import { describe, expect, it } from "vite-plus/test"
import { checkPage } from "./check"
import { buildRelease } from "./release"
import { loadTheme } from "./theme"

const SITES = new URL("../../../sites/", import.meta.url)

const sites = (await readdir(SITES, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const read = (site: string, file: string) =>
  readFile(new URL(`${site}/${file}`, SITES), "utf8")

describe.each(sites)("sites/%s", async (site) => {
  const theme = await loadTheme(await read(site, "theme.css"))
  const html = await read(site, "index.html")

  it("passes the house rules without warnings", async () => {
    const { errors, warnings } = await checkPage(html, theme)
    expect({ errors, warnings }).toEqual({ errors: [], warnings: [] })
  })

  it("publishes with a contact form", async () => {
    const release = await buildRelease(html, {
      theme,
      canonicalUrl: "https://r2c2.example/",
      sitekey: "1x00000000000000000000AA",
      elementsUrl: "/_elements/site.js",
      cssUrl: (hash) => `/assets/${hash}.css`,
    })
    expect(release.ok && release.forms.map((form) => form.name)).toEqual([
      "contact",
    ])
  })
})
