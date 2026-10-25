import {
  comingSoonHeaders,
  normaliseHost,
  normalisePath,
  redirectLocation,
  FORMS_PREFIX,
} from "@workspace/core"
import { handleForm } from "./forms"
import { lookup } from "./lookup"
import { builtInPage, notFound, withoutBody } from "./responses"

export { Renderer } from "./renderer"

async function route(
  request: Request,
  url: URL,
  env: Cloudflare.Env,
  ctx: ExecutionContext
) {
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
    const url = new URL(request.url)
    if (url.pathname.startsWith(FORMS_PREFIX)) {
      return handleForm(request, env, url)
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: { allow: "GET, HEAD" },
      })
    }
    const response = await route(request, url, env, ctx)
    return request.method === "HEAD"
      ? withoutBody(response, response)
      : response
  },
} satisfies ExportedHandler<Cloudflare.Env>
