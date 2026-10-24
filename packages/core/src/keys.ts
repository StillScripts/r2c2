const site = (siteId: string) => `sites/${siteId}`

export const routeKey = (host: string) => `host:${host}`

export function liveKey(siteId: string, path: string): string {
  const page = path === "/" ? "" : `${path.slice(1)}/`
  return `${site(siteId)}/live/${page}index.html`
}

export const versionKey = (siteId: string, hash: string) =>
  `${site(siteId)}/versions/${hash}.html`

export const assetKey = (siteId: string, hash: string, ext: string) =>
  `${site(siteId)}/assets/${hash}.${ext}`

export const notFoundKey = (siteId: string) => `${site(siteId)}/404.html`

export const elementsKey = (hash: string) => `shared/elements/${hash}.js`
