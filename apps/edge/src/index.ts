import {
  comingSoonHeaders,
  normaliseHost,
  normalisePath,
  type RouteEntry,
  routeEntrySchema,
  routeKey,
  stripTrackingParams,
} from "@workspace/core"

export { Renderer } from "./renderer"

const COMING_SOON_PAGE =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Coming soon</title></head><body><h1>Coming soon</h1></body></html>'

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "cache-control": "no-store" },
  })

async function lookup(
  routes: KVNamespace,
  host: string
): Promise<RouteEntry | null> {
  const value = await routes.get(routeKey(host), "json")
  if (value === null) return null
  const parsed = routeEntrySchema.safeParse(value)
  if (!parsed.success) console.error(`Malformed route entry for ${host}`)
  return parsed.success ? parsed.data : null
}

function redirect(target: string, from: URL) {
  const location = new URL(target)
  location.pathname = from.pathname
  location.search = from.search
  return new Response(null, {
    status: 301,
    headers: {
      location: location.href,
      "cache-control": "public, max-age=3600",
    },
  })
}

export default {
  async fetch(request, env, ctx) {
    const original = new URL(request.url)
    const url = stripTrackingParams(original)
    const path = normalisePath(url.pathname)
    if (!path) return notFound()

    const entry = await lookup(env.ROUTES, normaliseHost(url))
    if (!entry) return notFound()
    if ("redirect" in entry) return redirect(entry.redirect, original)
    if (entry.status === "coming-soon") {
      return new Response(COMING_SOON_PAGE, {
        headers: comingSoonHeaders(entry.site),
      })
    }

    url.pathname = path
    return ctx.exports
      .Renderer({ props: { siteId: entry.site } })
      .fetch(new Request(url, request))
  },
} satisfies ExportedHandler<Cloudflare.Env>
