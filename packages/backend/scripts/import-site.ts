import { execFileSync } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"

const slug = process.argv[2] ?? "r2c2"
const dir = new URL(`../../../sites/${slug}/`, import.meta.url)
const read = (file: string) => readFile(new URL(file, dir), "utf8")

const pages = await Promise.all(
  (await readdir(dir))
    .filter((file) => file.endsWith(".html"))
    .map(async (file) => ({
      path: file === "index.html" ? "/" : `/${file.slice(0, -".html".length)}`,
      html: await read(file),
    }))
)
const args = { slug, theme: await read("theme.css"), pages }

try {
  execFileSync("convex", ["run", "seed:importSite", JSON.stringify(args)], {
    stdio: "inherit",
  })
} catch {
  process.exit(1)
}
console.log(
  `Imported ${pages.map((page) => page.path).join(", ")} into ${slug}`
)
