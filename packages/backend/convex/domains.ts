import { parseHostname } from "@workspace/core"
import { v } from "convex/values"
import { audit, ownDoc, siteMutation, siteQuery } from "./access"
import { fail } from "./errors"
import { domainByHost, domainsOf, scheduleRouteSync } from "./routes"
import { domainKind } from "./validators"

export const list = siteQuery({
  args: {},
  handler: (ctx) => domainsOf(ctx, ctx.site._id),
})

export const add = siteMutation({
  role: "owner",
  args: { hostname: v.string(), kind: domainKind },
  handler: async (ctx, { hostname: input, kind }) => {
    const hostname = parseHostname(input)
    if (!hostname) throw fail("invalid_hostname")
    if (await domainByHost(ctx, hostname)) throw fail("hostname_taken")
    if (
      kind === "primary" &&
      (await domainsOf(ctx, ctx.site._id)).some((d) => d.kind === "primary")
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
      (await domainsOf(ctx, ctx.site._id)).some((d) => d.kind === "redirect")
    ) {
      throw fail("primary_has_redirects")
    }

    await ctx.db.delete("domains", domainId)
    await audit(ctx, { action: "domain.remove", target: domain.hostname })
    await scheduleRouteSync(ctx, ctx.site, [domain.hostname])
  },
})
