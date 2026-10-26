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
  // `address` is the site's own <slug>.<sites domain>, primary until a custom one is active
  kind: "primary" | "redirect" | "address"
  status: "pending" | "active"
}

const activeOf = <D extends RouteDomain>(domains: D[], kind: D["kind"]) =>
  domains.find((domain) => domain.kind === kind && domain.status === "active")

/** The domain a site is served on: its active custom primary, otherwise its address. */
export const primaryDomain = <D extends RouteDomain>(domains: D[]) =>
  activeOf(domains, "primary") ?? activeOf(domains, "address")

/** The KV entry each of a site's hostnames should hold; `null` means delete it. */
export function routeEntries(
  site: { id: string; status: SiteStatus },
  domains: RouteDomain[]
): [hostname: string, entry: RouteEntry | null][] {
  const primary = primaryDomain(domains)
  return domains.map((domain) => {
    if (domain.status !== "active") return [domain.hostname, null]
    if (domain === primary)
      return [domain.hostname, { site: site.id, status: site.status }]
    return [
      domain.hostname,
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
