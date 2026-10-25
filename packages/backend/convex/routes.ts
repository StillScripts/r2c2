import { type RouteEntry, routeKey } from "@workspace/core"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import {
  internalAction,
  internalQuery,
  type MutationCtx,
} from "./_generated/server"

type Site = Pick<Doc<"sites">, "_id" | "status">
type Domain = Pick<Doc<"domains">, "hostname" | "kind" | "status">

const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000]

/** The KV entry each of a site's hostnames should hold; `null` means delete it. */
export function routeEntries(
  site: Site,
  domains: Domain[]
): [hostname: string, entry: RouteEntry | null][] {
  const primary = domains.find(
    (domain) => domain.kind === "primary" && domain.status === "active"
  )
  return domains.map(({ hostname, kind, status }) => {
    if (status !== "active") return [hostname, null]
    if (kind === "primary") {
      return [hostname, { site: site._id, status: site.status }]
    }
    return [
      hostname,
      primary ? { redirect: `https://${primary.hostname}` } : null,
    ]
  })
}

/** Queue a KV rewrite for the site; call it in every mutation that changes what KV should hold. */
export async function scheduleRouteSync(
  ctx: MutationCtx,
  site: Doc<"sites">,
  removed?: string[]
) {
  const version = (site.routesVersion ?? 0) + 1
  await ctx.db.patch("sites", site._id, { routesVersion: version })
  await ctx.scheduler.runAfter(0, internal.routes.sync, {
    siteId: site._id,
    version,
    removed,
  })
}

export const state = internalQuery({
  args: { siteId: v.id("sites"), removed: v.array(v.string()) },
  handler: async (ctx, { siteId, removed }) => {
    const site = await ctx.db.get("sites", siteId)
    const domains = site
      ? await ctx.db
          .query("domains")
          .withIndex("by_site", (q) => q.eq("siteId", siteId))
          .collect()
      : []
    const stillUsed = await Promise.all(
      removed.map((hostname) =>
        ctx.db
          .query("domains")
          .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
          .first()
      )
    )
    return {
      site,
      domains,
      removed: removed.filter((_, i) => !stillUsed[i]),
    }
  },
})

function kvConfig() {
  const {
    CLOUDFLARE_API_TOKEN: token,
    CLOUDFLARE_ACCOUNT_ID: account,
    CLOUDFLARE_KV_NAMESPACE_ID: namespace,
  } = process.env
  if (!token || !account || !namespace) return null
  return {
    token,
    url: `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}`,
  }
}

async function kvRequest(
  kv: NonNullable<ReturnType<typeof kvConfig>>,
  path: "bulk" | "bulk/delete",
  method: "PUT" | "POST",
  body: unknown
) {
  const response = await fetch(`${kv.url}/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${kv.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const result = (await response.json().catch(() => null)) as {
    success?: boolean
  } | null
  if (!response.ok || !result?.success) {
    throw new Error(`Cloudflare KV ${path} failed with ${response.status}`)
  }
}

export const sync = internalAction({
  args: {
    siteId: v.id("sites"),
    version: v.number(),
    removed: v.optional(v.array(v.string())),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const kv = kvConfig()
    if (!kv) {
      console.log("Skipping KV sync: CLOUDFLARE_* variables aren't set")
      return
    }
    const { site, domains, removed } = await ctx.runQuery(
      internal.routes.state,
      {
        siteId: args.siteId,
        removed: args.removed ?? [],
      }
    )
    if ((site?.routesVersion ?? 0) > args.version) return

    const entries = site ? routeEntries(site, domains) : []
    const writes = entries.flatMap(([hostname, entry]) =>
      entry ? [{ key: routeKey(hostname), value: JSON.stringify(entry) }] : []
    )
    const deletes = [
      ...entries.flatMap(([hostname, entry]) => (entry ? [] : [hostname])),
      ...removed,
    ].map(routeKey)

    try {
      if (writes.length) await kvRequest(kv, "bulk", "PUT", writes)
      if (deletes.length) await kvRequest(kv, "bulk/delete", "POST", deletes)
    } catch (error) {
      const attempt = args.attempt ?? 1
      const delay = RETRY_DELAYS_MS[attempt - 1]
      if (delay === undefined) {
        console.error(
          `KV sync for ${args.siteId} gave up after ${attempt} attempts`,
          error
        )
        return
      }
      await ctx.scheduler.runAfter(delay, internal.routes.sync, {
        ...args,
        attempt: attempt + 1,
      })
    }
  },
})
