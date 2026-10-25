import {
  comingSoonHeaders,
  normaliseHost,
  normalisePath,
  redirectLocation,
  type RouteEntry,
  routeEntrySchema,
  routeKey,
} from "@workspace/core"
import { builtInPage, notFound, withoutBody } from "./responses"

export { Renderer } from "./renderer"

async function lookup(
  routes: KVNamespace,
  host: string
): Promise<RouteEntry | null> {
  const value = await routes.get(routeKey(host), "json")
  if (value === null) return null
  const parsed = routeEntrySchema.safeParse(value)
  if (parsed.success) return parsed.data
  console.error(`Malformed route entry for ${host}`)
  return null
}

async function route(
  request: Request,
  env: Cloudflare.Env,
  ctx: ExecutionContext
) {
  const url = new URL(request.url)
  const entry = await lookup(env.ROUTES, normaliseHost(url))
  if (!entry) return notFound()
  if ("redirect" in entry) {
    return new Response(null, {
      status: 301,
      headers: {
        location: redirectLocation(entry.redirect, url),
        "cache-control": "public, max-age=3600",
      },
    })
  }
  if (entry.status === "coming-soon") {
    return new Response(builtInPage("Coming soon"), {
      headers: comingSoonHeaders(entry.site),
    })
  }

  const path = normalisePath(url.pathname)
  if (!path) return notFound()

  url.pathname = path
  url.search = ""
  return ctx.exports
    .Renderer({ props: { siteId: entry.site } })
    .fetch(new Request(url, request))
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: { allow: "GET, HEAD" },
      })
    }
    const response = await route(request, env, ctx)
    return request.method === "HEAD"
      ? withoutBody(response, response)
      : response
  },
} satisfies ExportedHandler<Cloudflare.Env>
