import { execFileSync } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"

const slug = process.argv[2] ?? "r2c2"
const dir = new URL(`../../../sites/${slug}/`, import.meta.url)
const read = (file: string) => readFile(new URL(file, dir), "utf8")

const pathOf = (file: string) =>
  file === "index.html" ? "/" : `/${file.slice(0, -".html".length)}`

const files = (await readdir(dir)).filter((file) => file.endsWith(".html"))
const [theme, pages] = await Promise.all([
  read("theme.css"),
  Promise.all(
    files.map(async (file) => ({ path: pathOf(file), html: await read(file) }))
  ),
])

// One call per page keeps each argument well under Linux's 128 KB limit
const run = (args: object) =>
  execFileSync("convex", ["run", "seed:importSite", JSON.stringify(args)], {
    stdio: ["ignore", "ignore", "inherit"],
  })

try {
  run({ slug, theme, pages: [] })
  for (const page of pages) {
    run({ slug, pages: [page] })
    console.log(`Imported ${page.path} into ${slug}`)
  }
} catch {
  process.exit(1)
}
