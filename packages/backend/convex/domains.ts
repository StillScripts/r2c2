import { parseHostname } from "@workspace/core"
import { type Infer, v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import { internalMutation, type MutationCtx } from "./_generated/server"
import { audit, ownDoc, siteMutation, siteQuery, writeAudit } from "./access"
import { fail } from "./errors"
import { domainByHost, domainsOf, scheduleRouteSync } from "./routes"
import { findSite } from "./sites"
import { customDomainKind } from "./validators"

/** The domain every site has an address under: `lofty.page` in production, `localhost` in dev. */
const sitesDomain = () => process.env.SITES_DOMAIN || "localhost"

/** A site's own address, served until it has an active custom primary (ADR-015). */
export const siteAddress = (slug: string) => `${slug}.${sitesDomain()}`

const inSitesDomain = (hostname: string) =>
  hostname === sitesDomain() || hostname.endsWith(`.${sitesDomain()}`)

export const list = siteQuery({
  args: {},
  handler: (ctx) => domainsOf(ctx, ctx.site._id),
})

/** Check a hostname is free, then add it to the site, audit it and sync the site's routes. */
async function insertDomain(
  ctx: MutationCtx,
  site: Doc<"sites">,
  actor: string,
  hostname: string,
  kind: Infer<typeof customDomainKind>
) {
  if (await domainByHost(ctx, hostname)) throw fail("hostname_taken")
  if (
    kind === "primary" &&
    (await domainsOf(ctx, site._id)).some((d) => d.kind === "primary")
  ) {
    throw fail("primary_exists")
  }

  const domainId = await ctx.db.insert("domains", {
    siteId: site._id,
    hostname,
    kind,
    status: "active",
  })
  await writeAudit(ctx, {
    siteId: site._id,
    actor,
    action: "domain.add",
    target: hostname,
  })
  await scheduleRouteSync(ctx, site)
  return domainId
}

export const add = siteMutation({
  role: "owner",
  args: { hostname: v.string(), kind: customDomainKind },
  handler: async (ctx, { hostname: input, kind }) => {
    const hostname = parseHostname(input)
    if (!hostname) throw fail("invalid_hostname")
    if (inSitesDomain(hostname)) throw fail("reserved_hostname")
    return insertDomain(ctx, ctx.site, ctx.userId, hostname, kind)
  },
})

/**
 * Attach a hostname to a site from the CLI, including one in the sites domain that owners
 * can't add, such as the marketing site's own `lofty.page` (ADR-015):
 * `vp exec convex run domains:attach '{"slug": "r2c2", "hostname": "lofty.page", "kind": "primary"}'`
 */
export const attach = internalMutation({
  args: { slug: v.string(), hostname: v.string(), kind: customDomainKind },
  handler: async (ctx, { slug, hostname: input, kind }) => {
    const hostname = parseHostname(input)
    if (!hostname) throw fail("invalid_hostname")
    const site = await findSite(ctx, slug)
    if (!site) throw fail("not_found")
    return insertDomain(ctx, site, "system", hostname, kind)
  },
})

export const remove = siteMutation({
  role: "owner",
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const domain = await ownDoc(ctx, "domains", domainId)
    if (domain.kind === "address") throw fail("site_address")

    await ctx.db.delete("domains", domainId)
    await audit(ctx, { action: "domain.remove", target: domain.hostname })
    await scheduleRouteSync(ctx, ctx.site, [domain.hostname])
  },
})
