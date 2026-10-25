import { normaliseHost } from "@workspace/core"
import { v } from "convex/values"
import type { QueryCtx } from "./_generated/server"
import { audit, fail, ownDoc, siteMutation, siteQuery } from "./access"
import type { Doc } from "./_generated/dataModel"
import { scheduleRouteSync } from "./routes"
import { domainKind } from "./validators"

const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

/** Normalise a typed-in hostname, or return null if it isn't a bare hostname. */
export function parseHostname(input: string): string | null {
  const trimmed = input.trim()
  if (!/^[^/?#@\s]+$/.test(trimmed)) return null
  try {
    const hostname = normaliseHost(new URL(`https://${trimmed}`))
    return HOSTNAME.test(hostname) ? hostname : null
  } catch {
    return null
  }
}

const siteDomains = (ctx: QueryCtx & { site: Doc<"sites"> }) =>
  ctx.db
    .query("domains")
    .withIndex("by_site", (q) => q.eq("siteId", ctx.site._id))
    .collect()

export const list = siteQuery({
  args: {},
  handler: siteDomains,
})

export const add = siteMutation({
  role: "owner",
  args: { hostname: v.string(), kind: domainKind },
  handler: async (ctx, { hostname: input, kind }) => {
    const hostname = parseHostname(input)
    if (!hostname) throw fail("invalid_hostname")
    const taken = await ctx.db
      .query("domains")
      .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
      .first()
    if (taken) throw fail("hostname_taken")
    if (
      kind === "primary" &&
      (await siteDomains(ctx)).some((domain) => domain.kind === "primary")
    ) {
      throw fail("primary_exists")
    }

    const domainId = await ctx.db.insert("domains", {
      siteId: ctx.site._id,
      hostname,
      kind,
      status: "active",
    })
    await audit(ctx, { action: "domain.add", target: hostname })
    await scheduleRouteSync(ctx, ctx.site)
    return domainId
  },
})

export const remove = siteMutation({
  role: "owner",
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const domain = await ownDoc(ctx, "domains", domainId)
    if (
      domain.kind === "primary" &&
      (await siteDomains(ctx)).some((other) => other.kind === "redirect")
    ) {
      throw fail("primary_has_redirects")
    }

    await ctx.db.delete("domains", domainId)
    await audit(ctx, { action: "domain.remove", target: domain.hostname })
    await scheduleRouteSync(ctx, ctx.site, [domain.hostname])
  },
})
