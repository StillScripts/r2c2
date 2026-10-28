import { execFileSync } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"
import { MAX_PAGE_BYTES, pageBytes, parsePagePath } from "@workspace/core"
import { loadTheme } from "@workspace/html"

// Linux caps a single command-line argument at 128 KiB
const MAX_ARG_BYTES = 128 * 1024

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const args = process.argv.slice(2)
// `--into <slug>` loads the folder into a site with another slug, e.g. sites/r2c2 into r2c2-site
const intoAt = args.indexOf("--into")
const into = intoAt === -1 ? undefined : args.splice(intoAt, 2)[1]
if (intoAt !== -1 && (!into || into.startsWith("--"))) {
  fail("--into needs the slug of the site to import into.")
}
// Other flags such as --prod go to `convex run`, to pick a deployment other than .env.local's
const flags = args.filter((arg) => arg.startsWith("--"))
const folder = args.find((arg) => !arg.startsWith("--")) ?? "r2c2"
const slug = into ?? folder
for (const name of [folder, slug]) {
  if (!/^[a-z0-9-]+$/.test(name)) {
    fail(
      `"${name}" isn't a site slug: use lowercase letters, numbers and hyphens.`
    )
  }
}
const dir = new URL(`../../../sites/${folder}/`, import.meta.url)
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

// Check everything before writing anything, so a bad file can't leave a half-done import
await loadTheme(theme).catch((error: unknown) =>
  fail(`sites/${folder}/theme.css doesn't compile: ${String(error)}`)
)
const calls = [
  { label: "theme", args: { slug, theme, pages: [] } },
  ...pages.map((page) => ({ label: page.path, args: { slug, pages: [page] } })),
]
for (const { path, html } of pages) {
  if (!parsePagePath(path)) fail(`${path} isn't a valid page path.`)
  if (pageBytes(html) > MAX_PAGE_BYTES) {
    fail(`${path} is over the ${MAX_PAGE_BYTES / 1024} KB page limit.`)
  }
}
for (const call of calls) {
  const bytes = pageBytes(JSON.stringify(call.args))
  if (bytes > MAX_ARG_BYTES) {
    fail(
      `${call.label} is ${Math.ceil(bytes / 1024)} KB as JSON, over the 128 KB that \`convex run\` can take as an argument.`
    )
  }
}

// One call per page keeps each argument under MAX_ARG_BYTES
const run = (callArgs: object) =>
  execFileSync(
    "convex",
    ["run", ...flags, "seed:importSite", JSON.stringify(callArgs)],
    { stdio: ["ignore", "ignore", "inherit"] }
  )

try {
  for (const { label, args } of calls) {
    run(args)
    console.log(`Imported ${label} into ${slug}`)
  }
} catch (error) {
  // A `convex run` that exited with a status has already printed its error
  if (typeof (error as { status?: unknown }).status !== "number") {
    console.error(error)
  }
  process.exit(1)
}
