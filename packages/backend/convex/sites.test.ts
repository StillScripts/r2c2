import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { api, internal } from "./_generated/api"
import { addMember, addSite, errorCode, scheduled, setup } from "../test/setup"
import { brandOf } from "./sites"

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
      kind: "pages",
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

  test("creates an app site with no pages", async () => {
    const t = setup()
    const siteId = await t.mutation(internal.sites.create, {
      name: "Surf",
      slug: "surf",
      kind: "app",
    })

    const state = await t.run(async (ctx) => ({
      site: await ctx.db.get("sites", siteId),
      domains: await ctx.db.query("domains").collect(),
      pages: await ctx.db.query("pages").collect(),
    }))
    expect(state.site).toMatchObject({ kind: "app", status: "coming-soon" })
    expect(state.site?.liveBuildId).toBeUndefined()
    expect(state.domains).toEqual([
      expect.objectContaining({ hostname: "surf.localhost", kind: "address" }),
    ])
    expect(state.pages).toEqual([])
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

describe("site kinds", () => {
  async function appSite() {
    const t = setup()
    const siteId = await t.mutation(internal.sites.create, {
      name: "Surf",
      slug: "surf",
      kind: "app",
    })
    await addMember(t, siteId, { userId: "ann", role: "owner" })
    return { t, siteId, ann: t.withIdentity({ subject: "ann" }) }
  }

  test("a site stored without a kind is a pages site", async () => {
    const t = setup()
    const siteId = await addSite(t, "a", { userId: "ann", role: "owner" })
    const site = await t
      .withIdentity({ subject: "ann" })
      .query(api.sites.get, { siteId })
    expect(site.kind).toBe("pages")
  })

  test("an app site refuses new pages", async () => {
    const { siteId, ann } = await appSite()
    expect((await ann.query(api.sites.get, { siteId })).kind).toBe("app")
    await expect(
      ann.mutation(api.pages.create, { siteId, path: "/about", title: "About" })
    ).rejects.toEqual(errorCode("app_site"))
  })

  test("an app site refuses a theme", async () => {
    const { siteId, ann } = await appSite()
    await expect(
      ann.mutation(internal.sites.setTheme, { siteId, theme: "@theme {}" })
    ).rejects.toEqual(errorCode("app_site"))
  })

  test("an app site can't be imported into", async () => {
    const { t } = await appSite()
    await expect(
      t.mutation(internal.seed.importSite, {
        slug: "surf",
        pages: [{ path: "/", html: "<html></html>" }],
      })
    ).rejects.toEqual(errorCode("app_site"))
  })
})

describe("brandOf", () => {
  test("reads the theme's brand colour", () => {
    expect(
      brandOf(
        "@theme {\n  --color-brand-soft: #ecedff;\n  --color-brand: #2f3bff;\n}"
      )
    ).toBe("#2f3bff")
    expect(brandOf("@theme { --color-brand: oklch(0.5 0.2 260) }")).toBe(
      "oklch(0.5 0.2 260)"
    )
  })

  test("is null for a theme without one", () => {
    expect(brandOf("")).toBeNull()
    expect(brandOf("@theme { --color-brand-soft: #ecedff; }")).toBeNull()
  })
})
