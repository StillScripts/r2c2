import { z } from "zod"

export const routeEntrySchema = z.union([
  z.object({
    site: z.string().min(1),
    status: z.enum(["live", "coming-soon"]),
  }),
  z.object({
    redirect: z
      .url()
      .refine(
        (url) => URL.canParse(url) && new URL(url).origin === url,
        "Expected a bare origin"
      ),
  }),
])

export type RouteEntry = z.infer<typeof routeEntrySchema>

type SiteStatus = Extract<RouteEntry, { status: unknown }>["status"]

export type RouteDomain = {
  hostname: string
  kind: "primary" | "redirect"
  status: "pending" | "active"
}

/** The KV entry each of a site's hostnames should hold; `null` means delete it. */
export function routeEntries(
  site: { id: string; status: SiteStatus },
  domains: RouteDomain[]
): [hostname: string, entry: RouteEntry | null][] {
  const primary = domains.find(
    (domain) => domain.kind === "primary" && domain.status === "active"
  )
  return domains.map(({ hostname, kind, status }) => {
    if (status !== "active") return [hostname, null]
    if (kind === "primary")
      return [hostname, { site: site.id, status: site.status }]
    return [
      hostname,
      primary ? { redirect: `https://${primary.hostname}` } : null,
    ]
  })
}

/** Where a redirect entry sends a request: its origin, keeping the path and query. */
export function redirectLocation(origin: string, from: URL) {
  const location = new URL(origin)
  location.pathname = from.pathname
  location.search = from.search
  return location.href
}
