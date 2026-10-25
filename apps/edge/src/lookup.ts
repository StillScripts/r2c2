import { type RouteEntry, routeEntrySchema, routeKey } from "@workspace/core"

export async function lookup(
  routes: KVNamespace,
  host: string
): Promise<RouteEntry | null> {
  const value = await routes.get(routeKey(host), "json")
  if (value === null) return null
  const parsed = routeEntrySchema.safeParse(value)
  if (parsed.success) return parsed.data
  console.error(`Malformed route entry for ${host}`)
  return null
}
