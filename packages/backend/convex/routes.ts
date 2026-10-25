import { routeEntries, routeKey } from "@workspace/core"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalAction,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"

const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000]

export const domainsOf = (ctx: QueryCtx, siteId: Id<"sites">) =>
  ctx.db
    .query("domains")
    .withIndex("by_site", (q) => q.eq("siteId", siteId))
    .collect()

export const domainByHost = (ctx: QueryCtx, hostname: string) =>
  ctx.db
    .query("domains")
    .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
    .first()

/** Queue a KV rewrite for the site; call it in every mutation that changes what KV should hold. */
export async function scheduleRouteSync(
  ctx: MutationCtx,
  site: Pick<Doc<"sites">, "_id" | "routesVersion">,
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
    const [domains, stillUsed] = await Promise.all([
      site ? domainsOf(ctx, siteId) : [],
      Promise.all(removed.map((hostname) => domainByHost(ctx, hostname))),
    ])
    return {
      site,
      domains,
      removed: removed.filter((_, i) => !stillUsed[i]),
    }
  },
})

const KV_METHODS = { bulk: "PUT", "bulk/delete": "POST" } as const

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
  path: keyof typeof KV_METHODS,
  body: unknown[]
) {
  if (!body.length) return
  const response = await fetch(`${kv.url}/${path}`, {
    method: KV_METHODS[path],
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

    const writes: { key: string; value: string }[] = []
    const deletes = removed.map(routeKey)
    const entries = site
      ? routeEntries({ id: site._id, status: site.status }, domains)
      : []
    for (const [hostname, entry] of entries) {
      if (entry)
        writes.push({ key: routeKey(hostname), value: JSON.stringify(entry) })
      else deletes.push(routeKey(hostname))
    }

    try {
      await Promise.all([
        kvRequest(kv, "bulk", writes),
        kvRequest(kv, "bulk/delete", deletes),
      ])
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
