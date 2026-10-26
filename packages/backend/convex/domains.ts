import { parseHostname } from "@workspace/core"
import { v } from "convex/values"
import { audit, ownDoc, siteMutation, siteQuery } from "./access"
import { fail } from "./errors"
import { domainByHost, domainsOf, scheduleRouteSync } from "./routes"
import { domainKind } from "./validators"

/** The domain every site has an address under: `lofty.page` in production, `localhost` in dev. */
const sitesDomain = () => process.env.SITES_DOMAIN || "localhost"

/** A site's own address, its primary domain until it has a custom one (ADR-015). */
export const siteAddress = (slug: string) => `${slug}.${sitesDomain()}`

const inSitesDomain = (hostname: string) =>
  hostname === sitesDomain() || hostname.endsWith(`.${sitesDomain()}`)

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
    if (inSitesDomain(hostname)) throw fail("reserved_hostname")
    if (await domainByHost(ctx, hostname)) throw fail("hostname_taken")
    if (kind === "primary") {
      const primary = (await domainsOf(ctx, ctx.site._id)).find(
        (d) => d.kind === "primary"
      )
      // A custom primary takes over from the site's address, which then redirects to it
      if (primary?.hostname === siteAddress(ctx.site.slug)) {
        await ctx.db.patch("domains", primary._id, { kind: "redirect" })
      } else if (primary) {
        throw fail("primary_exists")
      }
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
    const address = siteAddress(ctx.site.slug)
    if (domain.hostname === address) throw fail("site_address")
    if (domain.kind === "primary") {
      const domains = await domainsOf(ctx, ctx.site._id)
      const own = domains.find((d) => d.hostname === address)
      // The site's address becomes primary again, so redirects still have somewhere to go
      if (own) await ctx.db.patch("domains", own._id, { kind: "primary" })
      else if (domains.some((d) => d.kind === "redirect")) {
        throw fail("primary_has_redirects")
      }
    }

    await ctx.db.delete("domains", domainId)
    await audit(ctx, { action: "domain.remove", target: domain.hostname })
    await scheduleRouteSync(ctx, ctx.site, [domain.hostname])
  },
})
