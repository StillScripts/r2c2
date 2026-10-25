import { WorkerEntrypoint } from "cloudflare:workers"
import {
  ASSET_HEADERS,
  ASSETS_PREFIX,
  assetKey,
  ELEMENTS_PREFIX,
  elementsKey,
  type LivePageMetadata,
  liveKey,
  notFoundHeaders,
  notFoundKey,
  pageHeaders,
} from "@workspace/core"

const CONTENT_TYPES: Record<string, string> = {
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  webp: "image/webp",
  avif: "image/avif",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  ico: "image/x-icon",
  woff2: "font/woff2",
}

const HASHED_NAME = /^([0-9a-f]{16})\.([a-z0-9]+)$/

const FALLBACK_404 =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page not found</title></head><body><h1>Page not found</h1></body></html>'

type RendererProps = { siteId: string }
type ObjectKey = (hash: string, ext: string) => string | null

export class Renderer extends WorkerEntrypoint<Cloudflare.Env, RendererProps> {
  async fetch(request: Request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, {
        status: 405,
        headers: { allow: "GET, HEAD" },
      })
    }
    const response = await this.#route(request)
    if (request.method === "GET") return response
    await response.body?.cancel()
    return new Response(null, response)
  }

  #route(request: Request) {
    const { siteId } = this.ctx.props
    const { pathname } = new URL(request.url)
    if (pathname.startsWith(ASSETS_PREFIX)) {
      return this.#asset(pathname.slice(ASSETS_PREFIX.length), (hash, ext) =>
        assetKey(siteId, hash, ext)
      )
    }
    if (pathname.startsWith(ELEMENTS_PREFIX)) {
      return this.#asset(pathname.slice(ELEMENTS_PREFIX.length), (hash, ext) =>
        ext === "js" ? elementsKey(hash) : null
      )
    }
    return this.#page(pathname, request.headers.get("if-none-match"))
  }

  async #asset(name: string, objectKey: ObjectKey) {
    const [, hash = "", ext = ""] = name.match(HASHED_NAME) ?? []
    const contentType = CONTENT_TYPES[ext]
    const key = contentType && objectKey(hash, ext)
    const object = key && (await this.env.SITES.get(key))
    if (!object) return this.#notFound()
    return new Response(object.body, {
      headers: {
        ...ASSET_HEADERS,
        "content-type": contentType,
        "x-content-type-options": "nosniff",
      },
    })
  }

  async #page(path: string, ifNoneMatch: string | null) {
    const { siteId } = this.ctx.props
    const object = await this.env.SITES.get(liveKey(siteId, path))
    if (!object) return this.#notFound()

    const { pageId, hash } = (object.customMetadata ??
      {}) as Partial<LivePageMetadata>
    const headers = pageHeaders({ siteId, pageId, hash: hash ?? object.etag })
    if (ifNoneMatch === headers.etag) {
      await object.body.cancel()
      return new Response(null, { status: 304, headers })
    }
    return new Response(object.body, { headers })
  }

  async #notFound() {
    const { siteId } = this.ctx.props
    const object = await this.env.SITES.get(notFoundKey(siteId))
    return new Response(object?.body ?? FALLBACK_404, {
      status: 404,
      headers: notFoundHeaders(siteId),
    })
  }
}
