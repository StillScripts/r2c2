import { describe, expect, test } from "vite-plus/test"
import { api } from "./_generated/api"
import { parseHostname } from "./domains"
import { addSite, scheduled, setup } from "../test/setup"

const error = (code: string) => expect.objectContaining({ data: { code } })

describe("parseHostname", () => {
  test.each([
    ["R2C2.dev", "r2c2.dev"],
    ["  www.r2c2.dev.  ", "www.r2c2.dev"],
    ["r2c2.dev:8787", "r2c2.dev"],
    ["r2c2.localhost", "r2c2.localhost"],
    ["bücher.example", "xn--bcher-kva.example"],
  ])("normalises %j", (input, expected) => {
    expect(parseHostname(input)).toBe(expected)
  })

  test.each([
    "",
    "localhost",
    "r2c2.dev/about",
    "user@r2c2.dev",
    "r2c2.dev?x=1",
    "https://r2c2.dev",
    "1.2.3.4",
    "-bad.dev",
    "two words.dev",
  ])("rejects %j", (input) => {
    expect(parseHostname(input)).toBeNull()
  })
})

async function ownedSite() {
  const t = setup()
  const siteId = await addSite(t, "a", { userId: "ann", role: "owner" })
  return { t, siteId, ann: t.withIdentity({ subject: "ann" }) }
}

describe("domains", () => {
  test("an owner adds a domain, which is audited and synced", async () => {
    const { t, siteId, ann } = await ownedSite()
    await ann.mutation(api.domains.add, {
      siteId,
      hostname: "A.dev:443",
      kind: "primary",
    })

    expect(await ann.query(api.domains.list, { siteId })).toEqual([
      expect.objectContaining({
        hostname: "a.dev",
        kind: "primary",
        status: "active",
      }),
    ])
    const state = await t.run(async (ctx) => ({
      site: await ctx.db.get("sites", siteId),
      log: await ctx.db.query("auditLog").collect(),
    }))
    expect(state.site?.routesVersion).toBe(1)
    expect(state.log).toEqual([
      expect.objectContaining({ action: "domain.add", target: "a.dev" }),
    ])
    expect(await scheduled(t)).toEqual([
      ["routes:sync", { siteId, version: 1 }],
    ])
  })

  test.each([
    ["invalid_hostname", "a.dev/path"],
    ["hostname_taken", "taken.dev"],
  ])("refuses with %s", async (code, hostname) => {
    const { t, siteId, ann } = await ownedSite()
    const other = await addSite(t, "b")
    await t.run((ctx) =>
      ctx.db.insert("domains", {
        siteId: other,
        hostname: "taken.dev",
        kind: "primary",
        status: "active",
      })
    )
    await expect(
      ann.mutation(api.domains.add, { siteId, hostname, kind: "redirect" })
    ).rejects.toEqual(error(code))
  })

  test("refuses a second primary", async () => {
    const { siteId, ann } = await ownedSite()
    await ann.mutation(api.domains.add, {
      siteId,
      hostname: "a.dev",
      kind: "primary",
    })
    await expect(
      ann.mutation(api.domains.add, {
        siteId,
        hostname: "b.dev",
        kind: "primary",
      })
    ).rejects.toEqual(error("primary_exists"))
  })

  test("removing a domain syncs its hostname away", async () => {
    const { t, siteId, ann } = await ownedSite()
    const domainId = await ann.mutation(api.domains.add, {
      siteId,
      hostname: "www.a.dev",
      kind: "redirect",
    })
    await ann.mutation(api.domains.remove, { siteId, domainId })

    expect(await ann.query(api.domains.list, { siteId })).toEqual([])
    expect((await scheduled(t)).at(-1)).toEqual([
      "routes:sync",
      { siteId, version: 2, removed: ["www.a.dev"] },
    ])
  })

  test("won't remove a primary that redirects still point at", async () => {
    const { siteId, ann } = await ownedSite()
    const primary = await ann.mutation(api.domains.add, {
      siteId,
      hostname: "a.dev",
      kind: "primary",
    })
    await ann.mutation(api.domains.add, {
      siteId,
      hostname: "www.a.dev",
      kind: "redirect",
    })
    await expect(
      ann.mutation(api.domains.remove, { siteId, domainId: primary })
    ).rejects.toEqual(error("primary_has_redirects"))
  })

  test("editors can't change domains and non-members can't see them", async () => {
    const { t, siteId } = await ownedSite()
    await t.run((ctx) =>
      ctx.db.insert("memberships", { userId: "eve", siteId, role: "editor" })
    )
    await expect(
      t.withIdentity({ subject: "eve" }).mutation(api.domains.add, {
        siteId,
        hostname: "a.dev",
        kind: "primary",
      })
    ).rejects.toEqual(error("forbidden"))
    await expect(
      t.withIdentity({ subject: "zed" }).query(api.domains.list, { siteId })
    ).rejects.toEqual(error("not_found"))
  })

  test("changing the site's status is audited and synced", async () => {
    const { t, siteId, ann } = await ownedSite()
    await ann.mutation(api.sites.setStatus, { siteId, status: "coming-soon" })
    const site = await t.run((ctx) => ctx.db.get("sites", siteId))
    expect(site).toMatchObject({ status: "coming-soon", routesVersion: 1 })
    expect(await scheduled(t)).toEqual([
      ["routes:sync", { siteId, version: 1 }],
    ])
  })
})
