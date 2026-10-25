const base = process.argv
  .slice(2)
  .find((arg) => arg !== "--")
  ?.replace(/\/$/, "")
if (!base)
  throw new Error("Usage: vp run --filter edge spike:check -- <worker URL>")

const run = Math.random().toString(36).slice(2, 8)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Render = {
  site: string
  renderId: string
  status: string | null
  cacheControl: string | null
}

async function get(path: string, site: string): Promise<Render> {
  const response = await fetch(`${base}${path}?site=${site}`)
  const body = (await response.json()) as { site: string; renderId: string }
  return {
    ...body,
    status: response.headers.get("cf-cache-status"),
    cacheControl: response.headers.get("cache-control"),
  }
}

async function cached(path: string, site: string) {
  const first = await get(path, site)
  for (let i = 0; i < 4; i++) {
    await sleep(500)
    const next = await get(path, site)
    if (next.renderId === first.renderId) return { first, next, hit: true }
  }
  return { first, next: await get(path, site), hit: false }
}

const results: Record<string, unknown> = { base, run }
type Verdict = "PASS" | "FAIL" | "SKIP"
const verdicts: [string, Verdict][] = []
const verdict = (name: string, ok: boolean, needsCache = true) =>
  verdicts.push([
    name,
    needsCache && !cachingWorks ? "SKIP" : ok ? "PASS" : "FAIL",
  ])
let cachingWorks = false

const home = `/page/home-${run}`
const a = await cached(home, "a")
results.caching = a
cachingWorks = a.hit
verdict("responses are cached at all", a.hit, false)

const b = await get(home, "b")
results.isolation = b
verdict(
  "props isolate sites (same path, different siteId)",
  b.site === "b" && b.renderId !== a.first.renderId
)

const bAgain = await cached(home, "b")
const purge = await (
  await fetch(`${base}/purge?site=a&tag=page-home-${run}`, { method: "POST" })
).json()
await sleep(2000)
const aAfter = await get(home, "a")
const bAfter = await get(home, "b")
results.purge = { purge, aAfter, bAfter, bBefore: bAgain.next }
verdict(
  "ctx.cache.purge clears the tagged page",
  aAfter.renderId !== a.first.renderId
)
verdict(
  "purge is tag-scoped (other site keeps its entry)",
  bAfter.renderId === bAgain.next.renderId
)

const short = `/short/page-${run}`
const s = await cached(short, "a")
await sleep(7000)
const sLater = await get(short, "a")
results.sMaxage = { s, sLater }
verdict(
  "s-maxage (5s) applies at the edge despite max-age=3600",
  s.hit && sLater.renderId !== s.first.renderId
)
verdict(
  "browser still gets max-age=3600",
  (s.first.cacheControl ?? "").includes("max-age=3600"),
  false
)

for (const [name, ok] of verdicts)
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
console.log("\nPaste everything below into the chat:\n")
console.log(JSON.stringify({ verdicts, results }, null, 2))
if (verdicts.some(([, result]) => result !== "PASS")) process.exitCode = 1

export {}
