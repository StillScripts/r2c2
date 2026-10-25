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

    const short = pathname.startsWith("/short/")
    return Response.json(
      { site: siteId, path: pathname, renderId: crypto.randomUUID() },
      {
        headers: {
          "cache-control": short
            ? "public, max-age=3600, s-maxage=5"
            : "public, max-age=0, s-maxage=60",
          "cache-tag": `site-${siteId},page-${pathname.split("/").pop()}`,
        },
      }
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
