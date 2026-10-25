const base = process.argv
  .slice(2)
  .find((arg) => arg !== "--")
  ?.replace(/\/$/, "")
if (!base) throw new Error("Usage: vp run spike:check -- <worker URL>")

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
  let next = first
  for (let i = 0; i < 4; i++) {
    await sleep(500)
    next = await get(path, site)
    if (next.renderId === first.renderId) return { first, next, hit: true }
  }
  return { first, next, hit: false }
}

const page = `home-${run}`
const home = `/page/${page}`
const short = `/short/page-${run}`

const caching = await cached(home, "a")
const isolation = await get(home, "b")
const bBefore = (await cached(home, "b")).next
const purge = await (
  await fetch(`${base}/purge?site=a&tag=page-${page}`, { method: "POST" })
).json()
await sleep(2000)
const [aAfter, bAfter] = await Promise.all([get(home, "a"), get(home, "b")])
const sMaxage = await cached(short, "a")
await sleep(7000)
const sLater = await get(short, "a")

const cachingWorks = caching.hit
const verdict = (ok: boolean, needsCache = true) =>
  needsCache && !cachingWorks ? "SKIP" : ok ? "PASS" : "FAIL"

const verdicts: [string, string][] = [
  ["responses are cached at all", verdict(caching.hit, false)],
  [
    "props isolate sites (same path, different siteId)",
    verdict(
      isolation.site === "b" && isolation.renderId !== caching.first.renderId
    ),
  ],
  [
    "ctx.cache.purge clears the tagged page",
    verdict(aAfter.renderId !== caching.first.renderId),
  ],
  [
    "purge only reaches the calling site (same tag, other props kept)",
    verdict(bAfter.renderId === bBefore.renderId),
  ],
  [
    "s-maxage (5s) applies at the edge despite max-age=3600",
    verdict(sMaxage.hit && sLater.renderId !== sMaxage.first.renderId),
  ],
  [
    "browser still gets max-age=3600",
    verdict((sMaxage.first.cacheControl ?? "").includes("max-age=3600"), false),
  ],
]

for (const [name, result] of verdicts) console.log(`${result}  ${name}`)
console.log("\nPaste everything below into the chat:\n")
console.log(
  JSON.stringify(
    {
      base,
      run,
      verdicts,
      results: {
        caching,
        isolation,
        purge,
        aAfter,
        bAfter,
        bBefore,
        sMaxage,
        sLater,
      },
    },
    null,
    2
  )
)
if (verdicts.some(([, result]) => result !== "PASS")) process.exitCode = 1

export {}
