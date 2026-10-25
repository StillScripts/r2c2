import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { AstroIntegration } from "astro"

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url))
const contentDir = fileURLToPath(new URL("./content/", import.meta.url))
const githubUrl = "https://github.com/StillScripts/r2c2"

const sources = ["docs/plans", "docs/decisions", "tasks"]

function routeFor(repoPath: string) {
  const [dir, sub, file] = repoPath.split("/")
  if (dir === "docs" && (sub === "plans" || sub === "decisions") && file) {
    return `/${sub}/${file.replace(/\.md$/, "").toLowerCase()}/`
  }
  if (dir === "tasks" && file) {
    const page = sub === "done" ? "/roadmap/completed/" : "/roadmap/"
    return `${page}#${file.replace(/\.md$/, "")}`
  }
  return `${githubUrl}/blob/master/${repoPath}`
}

function rewriteLinks(markdown: string, repoPath: string) {
  return markdown.replace(
    /\]\((?![a-z]+:|#)([^)\s#]+)(#[^)\s]*)?\)/g,
    (_, target: string, hash = "") => {
      const resolved = path.posix.join(path.posix.dirname(repoPath), target)
      const route = routeFor(resolved)
      return `](${route.includes("#") ? route : route + hash})`
    }
  )
}

const quoteValues = (fields: string) =>
  fields.replace(
    /^([\w-]+): (.*: .*)$/gm,
    (_, key: string, value: string) => `${key}: ${JSON.stringify(value)}`
  )

function withFrontmatter(markdown: string, repoPath: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/)
  const fields = match ? quoteValues(match[1]) : ""
  let body = match ? markdown.slice(match[0].length) : markdown

  const heading = body.match(/^\s*# (.+)\n/)
  if (heading) body = body.slice(heading[0].length)

  const lines = fields ? [fields] : []
  if (!/^title:/m.test(fields)) {
    const title = heading?.[1] ?? path.basename(repoPath, ".md")
    lines.push(`title: ${JSON.stringify(title)}`)
  }
  lines.push(`editUrl: ${githubUrl}/edit/master/${repoPath}`)
  return `---\n${lines.join("\n")}\n---\n${body}`
}

async function markdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
}

async function syncSource(source: string) {
  const target = path.join(contentDir, source)
  await rm(target, { recursive: true, force: true })
  for (const file of await markdownFiles(path.join(repoRoot, source))) {
    const repoPath = path.posix.join(source, file.split(path.sep).join("/"))
    const markdown = await readFile(path.join(repoRoot, repoPath), "utf8")
    const out = path.join(target, file)
    await mkdir(path.dirname(out), { recursive: true })
    await writeFile(
      out,
      withFrontmatter(rewriteLinks(markdown, repoPath), repoPath)
    )
  }
}

export function syncContent(): AstroIntegration {
  return {
    name: "sync-content",
    hooks: {
      "astro:config:setup": async ({ logger }) => {
        await Promise.all(sources.map(syncSource))
        logger.info(`Copied ${sources.join(", ")}`)
      },
      "astro:server:setup": ({ server }) => {
        server.watcher.add(sources.map((s) => path.join(repoRoot, s)))
        server.watcher.on("all", (_, file) => {
          const source = sources.find((s) =>
            file.startsWith(path.join(repoRoot, s) + path.sep)
          )
          if (source) void syncSource(source)
        })
      },
    },
  }
}
