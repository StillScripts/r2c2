import { pageHeaders } from "@workspace/core"
import { WorkerEntrypoint } from "cloudflare:workers"

type Props = { siteId: string }

export class Renderer extends WorkerEntrypoint<Cloudflare.Env, Props> {
  async fetch(request: Request) {
    const { pathname, searchParams } = new URL(request.url)
    const { siteId } = this.ctx.props

    if (request.method === "POST" && pathname === "/purge") {
      const tag = searchParams.get("tag") ?? ""
      const result = await this.ctx.cache?.purge({ tags: [tag] })
      return Response.json({ purged: tag, hasCache: !!this.ctx.cache, result })
    }

    const renderId = crypto.randomUUID()
    const headers = new Headers(
      pageHeaders({
        siteId,
        pageId: pathname.split("/").pop()!,
        hash: renderId,
      })
    )
    if (pathname.startsWith("/short/")) {
      headers.set("cache-control", "public, max-age=3600, s-maxage=5")
    }
    return Response.json(
      { site: siteId, path: pathname, renderId },
      { headers }
    )
  }
}

export default {
  fetch(request, _env, ctx) {
    const url = new URL(request.url)
    const siteId = url.searchParams.get("site") ?? "default"
    url.searchParams.delete("site")
    return ctx.exports
      .Renderer({ props: { siteId } })
      .fetch(new Request(url, request))
  },
} satisfies ExportedHandler<Cloudflare.Env>
