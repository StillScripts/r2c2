import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { AstroIntegration } from "astro"

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url))
const contentDir = fileURLToPath(new URL("./content/", import.meta.url))
export const githubUrl = "https://github.com/StillScripts/r2c2"

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

const normaliseFields = (fields: string) =>
  fields
    .replace(
      /^([\w-]+): (.*: .*)$/gm,
      (_, key: string, value: string) => `${key}: ${JSON.stringify(value)}`
    )
    .replace(/^plan: (.+)$/m, (_, plan: string) => `plan: ${routeFor(plan)}`)

function withFrontmatter(markdown: string, repoPath: string) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/)
  const fields = match ? normaliseFields(match[1]) : ""
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

const toPosix = (file: string) => file.split(path.sep).join("/")

const outputOf = (repoPath: string) => path.join(contentDir, repoPath)

async function markdownFiles(source: string) {
  const dir = path.join(repoRoot, source)
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) =>
      toPosix(path.relative(repoRoot, path.join(e.parentPath, e.name)))
    )
}

async function copyFile(repoPath: string) {
  const markdown = await readFile(path.join(repoRoot, repoPath), "utf8")
  const out = outputOf(repoPath)
  await mkdir(path.dirname(out), { recursive: true })
  await writeFile(
    out,
    withFrontmatter(rewriteLinks(markdown, repoPath), repoPath)
  )
}

async function syncSource(source: string) {
  await rm(outputOf(source), { recursive: true, force: true })
  await Promise.all((await markdownFiles(source)).map(copyFile))
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
        server.watcher.on("all", (event, file) => {
          const repoPath = toPosix(path.relative(repoRoot, file))
          const watched = sources.some((s) => repoPath.startsWith(`${s}/`))
          if (!watched || !repoPath.endsWith(".md")) return
          void (event === "unlink"
            ? rm(outputOf(repoPath), { force: true })
            : copyFile(repoPath))
        })
      },
    },
  }
}
