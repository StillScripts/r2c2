import {
  normaliseHost,
  normalisePath,
  stripTrackingParams,
} from "@workspace/core"

export { Renderer } from "./renderer"

export default {
  fetch(request, _env, ctx) {
    const url = stripTrackingParams(new URL(request.url))
    const path = normalisePath(url.pathname)
    if (!path) return new Response("Not found", { status: 404 })

    url.pathname = path
    return ctx.exports
      .Renderer({ props: { siteId: normaliseHost(url) } })
      .fetch(new Request(url, request))
  },
} satisfies ExportedHandler<Cloudflare.Env>
