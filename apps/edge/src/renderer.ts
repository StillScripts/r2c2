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
import { builtInPage, notFound, withoutBody } from "./responses"

type RendererProps = { siteId: string }

export class Renderer extends WorkerEntrypoint<Cloudflare.Env, RendererProps> {
  get #siteId() {
    return this.ctx.props.siteId
  }

  fetch(request: Request) {
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
    if (!asset || !object) return notFound()
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
    return new Response(object?.body ?? builtInPage("Page not found"), {
      status: 404,
      headers: notFoundHeaders(this.#siteId),
    })
  }
}
