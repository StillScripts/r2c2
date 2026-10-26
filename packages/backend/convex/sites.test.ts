import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { internal } from "./_generated/api"
import { scheduled, setup } from "../test/setup"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("sites:create", () => {
  test("creates a coming-soon site at its own address, and syncs it", async () => {
    vi.stubEnv("SITES_DOMAIN", "lofty.page")
    const t = setup()
    const siteId = await t.mutation(internal.sites.create, {
      name: "Acme Dental",
      slug: "acme-dental",
    })

    const state = await t.run(async (ctx) => ({
      site: await ctx.db.get("sites", siteId),
      domains: await ctx.db.query("domains").collect(),
      pages: await ctx.db.query("pages").collect(),
      log: await ctx.db.query("auditLog").collect(),
    }))
    expect(state.site).toMatchObject({
      name: "Acme Dental",
      slug: "acme-dental",
      status: "coming-soon",
    })
    expect(state.domains).toEqual([
      expect.objectContaining({
        hostname: "acme-dental.lofty.page",
        kind: "address",
        status: "active",
      }),
    ])
    expect(state.pages).toEqual([
      expect.objectContaining({ path: "/", title: "Acme Dental" }),
    ])
    expect(state.log).toEqual([
      expect.objectContaining({ action: "site.create", actor: "system" }),
    ])
    expect(await scheduled(t)).toEqual([
      ["routes:sync", { siteId, version: 1 }],
    ])
  })

  test("uses localhost when SITES_DOMAIN isn't set", async () => {
    const t = setup()
    await t.mutation(internal.sites.create, { name: "A", slug: "a" })
    const domain = await t.run((ctx) => ctx.db.query("domains").first())
    expect(domain?.hostname).toBe("a.localhost")
  })

  test.each(["Acme", "acme.dental", "www"])(
    "refuses the slug %j",
    async (slug) => {
      const t = setup()
      await expect(
        t.mutation(internal.sites.create, { name: "A", slug })
      ).rejects.toThrow("isn't a site slug")
    }
  )

  test("refuses a slug that's taken", async () => {
    const t = setup()
    await t.mutation(internal.sites.create, { name: "A", slug: "a" })
    await expect(
      t.mutation(internal.sites.create, { name: "B", slug: "a" })
    ).rejects.toThrow("already exists")
  })
})
