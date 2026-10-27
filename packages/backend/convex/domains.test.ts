import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test"
import { api, internal } from "./_generated/api"
import { addMember, addSite, errorCode, scheduled, setup } from "../test/setup"

async function ownedSite() {
  const t = setup()
  const siteId = await addSite(t, "a", { userId: "ann", role: "owner" })
  return { t, siteId, ann: t.withIdentity({ subject: "ann" }) }
}

/** A site made by `sites:create`, so it has its `a.localhost` address. */
async function siteWithAddress() {
  const t = setup()
  const siteId = await t.mutation(internal.sites.create, {
    name: "A",
    slug: "a",
  })
  await t.run((ctx) =>
    ctx.db.insert("memberships", { userId: "ann", siteId, role: "owner" })
  )
  const ann = t.withIdentity({ subject: "ann" })
  const kinds = async () =>
    Object.fromEntries(
      (await ann.query(api.domains.list, { siteId })).map((d) => [
        d.hostname,
        d.kind,
      ])
    )
  return { t, siteId, ann, kinds }
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
    ["reserved_hostname", "b.localhost"],
    ["reserved_hostname", "www.b.localhost"],
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
    ).rejects.toEqual(errorCode(code))
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
    ).rejects.toEqual(errorCode("primary_exists"))
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

  test("editors can't change domains and non-members can't see them", async () => {
    const { t, siteId } = await ownedSite()
    await addMember(t, siteId, { userId: "eve", role: "editor" })
    await expect(
      t.withIdentity({ subject: "eve" }).mutation(api.domains.add, {
        siteId,
        hostname: "a.dev",
        kind: "primary",
      })
    ).rejects.toEqual(errorCode("forbidden"))
    await expect(
      t.withIdentity({ subject: "zed" }).query(api.domains.list, { siteId })
    ).rejects.toEqual(errorCode("not_found"))
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

  test("a custom primary sits beside the site's address", async () => {
    const { ann, siteId, kinds } = await siteWithAddress()
    await ann.mutation(api.domains.add, {
      siteId,
      hostname: "a.dev",
      kind: "primary",
    })
    expect(await kinds()).toEqual({
      "a.localhost": "address",
      "a.dev": "primary",
    })
  })

  test("the custom primary can be removed, leaving the address", async () => {
    const { ann, siteId, kinds } = await siteWithAddress()
    const custom = await ann.mutation(api.domains.add, {
      siteId,
      hostname: "a.dev",
      kind: "primary",
    })
    await ann.mutation(api.domains.add, {
      siteId,
      hostname: "www.a.dev",
      kind: "redirect",
    })
    await ann.mutation(api.domains.remove, { siteId, domainId: custom })
    expect(await kinds()).toEqual({
      "a.localhost": "address",
      "www.a.dev": "redirect",
    })
  })

  test("won't remove the site's address", async () => {
    const { ann, siteId } = await siteWithAddress()
    const [address] = await ann.query(api.domains.list, { siteId })
    await expect(
      ann.mutation(api.domains.remove, { siteId, domainId: address!._id })
    ).rejects.toEqual(errorCode("site_address"))
  })

  describe("attach from the CLI", () => {
    beforeEach(() => {
      vi.stubEnv("SITES_DOMAIN", "lofty.page")
    })
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    test("takes hostnames in the sites domain, audited as the system and synced", async () => {
      const { t, siteId, kinds } = await siteWithAddress()
      await t.mutation(internal.domains.attach, {
        slug: "a",
        hostname: "lofty.page",
        kind: "primary",
      })
      await t.mutation(internal.domains.attach, {
        slug: "a",
        hostname: "WWW.lofty.page",
        kind: "redirect",
      })

      expect(await kinds()).toEqual({
        "a.lofty.page": "address",
        "lofty.page": "primary",
        "www.lofty.page": "redirect",
      })
      const log = await t.run((ctx) => ctx.db.query("auditLog").collect())
      expect(log).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actor: "system",
            action: "domain.add",
            target: "lofty.page",
          }),
        ])
      )
      expect(await scheduled(t)).toContainEqual([
        "routes:sync",
        { siteId, version: 3 },
      ])
    })

    test.each([
      ["hostname_taken", "a.lofty.page", "redirect"],
      ["hostname_taken", "b.lofty.page", "redirect"],
      ["invalid_hostname", "lofty.page/path", "redirect"],
    ] as const)("refuses with %s for %s", async (code, hostname, kind) => {
      const { t } = await siteWithAddress()
      await t.mutation(internal.sites.create, { name: "B", slug: "b" })
      await expect(
        t.mutation(internal.domains.attach, { slug: "a", hostname, kind })
      ).rejects.toEqual(errorCode(code))
    })

    test("refuses a second primary", async () => {
      const { t } = await siteWithAddress()
      const attach = (hostname: string) =>
        t.mutation(internal.domains.attach, {
          slug: "a",
          hostname,
          kind: "primary",
        })
      await attach("lofty.page")
      await expect(attach("a.dev")).rejects.toEqual(errorCode("primary_exists"))
    })

    test("refuses an unknown site", async () => {
      const t = setup()
      await expect(
        t.mutation(internal.domains.attach, {
          slug: "nope",
          hostname: "lofty.page",
          kind: "primary",
        })
      ).rejects.toEqual(errorCode("not_found"))
    })
  })
})
