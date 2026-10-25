import { describe, expect, test } from "vite-plus/test"
import { api } from "./_generated/api"
import { addSite, errorCode, setup } from "../test/setup"

describe("site access", () => {
  test("signed-out callers are refused", async () => {
    const t = setup()
    const siteId = await addSite(t, "a")
    await expect(t.query(api.sites.get, { siteId })).rejects.toEqual(
      errorCode("unauthenticated")
    )
    await expect(
      t.mutation(api.sites.rename, { siteId, name: "x" })
    ).rejects.toEqual(errorCode("unauthenticated"))
  })

  test("members read their own site and nobody else's", async () => {
    const t = setup()
    const a = await addSite(t, "a", { userId: "ann", role: "editor" })
    const b = await addSite(t, "b", { userId: "bob", role: "owner" })
    const ann = t.withIdentity({ subject: "ann" })

    expect(await ann.query(api.sites.get, { siteId: a })).toMatchObject({
      slug: "a",
    })
    await expect(ann.query(api.sites.get, { siteId: b })).rejects.toEqual(
      errorCode("not_found")
    )
  })

  test("a deleted site looks the same as someone else's", async () => {
    const t = setup()
    const a = await addSite(t, "a", { userId: "ann", role: "owner" })
    await t.run((ctx) => ctx.db.delete("sites", a))
    await expect(
      t.withIdentity({ subject: "ann" }).query(api.sites.get, { siteId: a })
    ).rejects.toEqual(errorCode("not_found"))
  })

  test("only owners rename, and each rename is audited", async () => {
    const t = setup()
    const a = await addSite(t, "a", { userId: "ann", role: "owner" })
    await t.run((ctx) =>
      ctx.db.insert("memberships", { userId: "eve", siteId: a, role: "editor" })
    )

    await expect(
      t
        .withIdentity({ subject: "eve" })
        .mutation(api.sites.rename, { siteId: a, name: "Eve's" })
    ).rejects.toEqual(errorCode("forbidden"))

    await t
      .withIdentity({ subject: "ann" })
      .mutation(api.sites.rename, { siteId: a, name: "Ann's" })

    const [site, log] = await t.run(async (ctx) => [
      await ctx.db.get("sites", a),
      await ctx.db.query("auditLog").collect(),
    ])
    expect(site?.name).toBe("Ann's")
    expect(log).toEqual([
      expect.objectContaining({
        siteId: a,
        actor: "ann",
        action: "site.rename",
        target: a,
      }),
    ])
  })

  test("an owner of one site can't rename another", async () => {
    const t = setup()
    await addSite(t, "a", { userId: "ann", role: "owner" })
    const b = await addSite(t, "b")
    await expect(
      t
        .withIdentity({ subject: "ann" })
        .mutation(api.sites.rename, { siteId: b, name: "taken" })
    ).rejects.toEqual(errorCode("not_found"))
    const site = await t.run((ctx) => ctx.db.get("sites", b))
    expect(site?.name).toBe("b")
  })

  test("documents from another site are not found", async () => {
    const t = setup()
    const a = await addSite(t, "a", { userId: "ann", role: "owner" })
    const b = await addSite(t, "b")
    const [pageA, pageB] = await t.run(async (ctx) => {
      const page = { path: "/", title: "Home", draftHtml: "" }
      return [
        await ctx.db.insert("pages", { siteId: a, ...page }),
        await ctx.db.insert("pages", { siteId: b, ...page }),
      ]
    })
    const ann = t.withIdentity({ subject: "ann" })

    expect(
      await ann.query(api.pages.get, { siteId: a, pageId: pageA })
    ).toMatchObject({ siteId: a })
    await expect(
      ann.query(api.pages.get, { siteId: a, pageId: pageB })
    ).rejects.toEqual(errorCode("not_found"))
  })
})
