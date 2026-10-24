import { WorkerEntrypoint } from "cloudflare:workers"
import {
  normaliseHost,
  normalisePath,
  stripTrackingParams,
} from "@workspace/core"

type RendererProps = { siteId: string }

export class Renderer extends WorkerEntrypoint<Cloudflare.Env, RendererProps> {
  fetch(request: Request) {
    const { pathname } = new URL(request.url)
    return new Response(`Hello from ${this.ctx.props.siteId}${pathname}`)
  }
}

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
