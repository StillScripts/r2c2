import { WorkerEntrypoint } from "cloudflare:workers"
import {
  assetHeaders,
  ASSETS_PREFIX,
  assetKey,
  ELEMENTS_PREFIX,
  elementsKey,
  type LivePageMetadata,
  liveKey,
  notFoundHeaders,
  notFoundKey,
  pageHeaders,
  parseAssetName,
  siteTag,
} from "@workspace/core"

const FALLBACK_404 =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page not found</title></head><body><h1>Page not found</h1></body></html>'

type RendererProps = { siteId: string }

const withoutBody = async (
  source: { body: ReadableStream | null },
  init: ResponseInit
) => {
  await source.body?.cancel()
  return new Response(null, init)
}

export class Renderer extends WorkerEntrypoint<Cloudflare.Env, RendererProps> {
  get #siteId() {
    return this.ctx.props.siteId
  }

  async fetch(request: Request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: { allow: "GET, HEAD" },
      })
    }
    const response = await this.#route(request)
    return request.method === "HEAD"
      ? withoutBody(response, response)
      : response
  }

  #route(request: Request) {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith(ASSETS_PREFIX)) {
      const asset = parseAssetName(pathname.slice(ASSETS_PREFIX.length))
      return this.#asset(
        asset && {
          ...asset,
          key: assetKey(this.#siteId, asset.hash, asset.ext),
        }
      )
    }
    if (pathname.startsWith(ELEMENTS_PREFIX)) {
      const script = parseAssetName(pathname.slice(ELEMENTS_PREFIX.length))
      return this.#asset(
        script?.ext === "js"
          ? { ...script, key: elementsKey(script.hash) }
          : null
      )
    }
    return this.#page(pathname, request.headers.get("if-none-match"))
  }

  async #asset(asset: { key: string; contentType: string } | null) {
    const object = asset && (await this.env.SITES.get(asset.key))
    if (!asset || !object) return new Response("Not found", { status: 404 })
    return new Response(object.body, {
      headers: assetHeaders(asset.contentType),
    })
  }

  async #page(path: string, ifNoneMatch: string | null) {
    const siteId = this.#siteId
    const object = await this.env.SITES.get(liveKey(siteId, path))
    if (!object) return this.#notFound()

    const { pageId, hash = object.etag }: Partial<LivePageMetadata> =
      object.customMetadata ?? {}
    const headers = pageHeaders({ siteId, pageId: pageId ?? "", hash })
    if (!pageId) headers["cache-tag"] = siteTag(siteId)
    if (ifNoneMatch === headers.etag) {
      return withoutBody(object, { status: 304, headers })
    }
    return new Response(object.body, { headers })
  }

  async #notFound() {
    const object = await this.env.SITES.get(notFoundKey(this.#siteId))
    return new Response(object?.body ?? FALLBACK_404, {
      status: 404,
      headers: notFoundHeaders(this.#siteId),
    })
  }
}
