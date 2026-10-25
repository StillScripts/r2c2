import { describe, expect, test, vi } from "vite-plus/test"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { draftHistory } from "./history"
import { formClash } from "./publishing"
import { addSite, errorCode, setup } from "../test/setup"

const contact = (...names: string[]) => ({
  name: "contact",
  fields: names.map((name) => ({ name, type: "text", required: true })),
})

async function site() {
  const t = setup()
  const siteId = await addSite(t, "a", { userId: "ed", role: "editor" })
  const ed = t.withIdentity({ subject: "ed" })
  const addPage = (path: string) =>
    ed.mutation(api.pages.create, { siteId, path, title: path })
  const pageId = await addPage("/")
  const release = (
    overrides: Partial<{
      pageId: Id<"pages">
      draftHtml: string
      draftWithIds: string
      hash: string
      actor: string
      forms: ReturnType<typeof contact>[]
    }> = {}
  ) => ({
    siteId,
    pageId,
    actor: "ed",
    draftHtml: "<p>draft</p>",
    draftWithIds: '<p data-r2c2-id="a">draft</p>',
    hash: "h1",
    cssHash: "c1",
    forms: [],
    ...overrides,
  })
  const page = (id: Id<"pages"> = pageId) =>
    t.run((ctx) => ctx.db.get("pages", id))
  const registry = () => t.run((ctx) => ctx.db.query("forms").collect())
  return { t, siteId, ed, pageId, addPage, release, page, registry }
}

describe("formClash", () => {
  test("finds a form with the same name and different fields", () => {
    expect(formClash([contact("email")], [contact("phone")])).toBe("contact")
    expect(
      formClash([contact("email", "name")], [contact("name", "email")])
    ).toBeUndefined()
    expect(
      formClash([contact("email")], [{ ...contact("x"), name: "other" }])
    ).toBeUndefined()
  })
})

describe("publishing.context", () => {
  test("refuses outsiders and signed-out callers", async () => {
    const { t, siteId, pageId } = await site()
    await expect(
      t
        .withIdentity({ subject: "eve" })
        .query(internal.publishing.publishContext, { siteId, pageId })
    ).rejects.toEqual(errorCode("not_found"))
    await expect(
      t.query(internal.publishing.publishContext, { siteId, pageId })
    ).rejects.toEqual(errorCode("unauthenticated"))
  })

  test("builds the canonical URL from the primary domain", async () => {
    const { t, siteId, ed, addPage } = await site()
    const pageId = await addPage("/about")
    const context = () =>
      ed.query(internal.publishing.publishContext, { siteId, pageId })
    expect((await context()).canonicalUrl).toBeUndefined()

    await t.run((ctx) =>
      ctx.db.insert("domains", {
        siteId,
        hostname: "a.dev",
        kind: "primary",
        status: "active",
      })
    )
    expect(await context()).toMatchObject({
      userId: "ed",
      canonicalUrl: "https://a.dev/about",
    })
  })

  test("lists the forms on other live pages", async () => {
    const { t, siteId, ed, pageId, addPage, release } = await site()
    const other = await addPage("/contact")
    await t.mutation(
      internal.publishing.markLive,
      release({ pageId: other, forms: [contact("email")] })
    )
    await t.mutation(
      internal.publishing.markLive,
      release({ forms: [{ ...contact("phone"), name: "call-back" }] })
    )

    const context = await ed.query(internal.publishing.publishContext, {
      siteId,
      pageId,
    })
    expect(context.otherForms).toEqual([contact("email")])
  })

  test("refuses another page's version", async () => {
    const { t, siteId, ed, pageId, addPage, release } = await site()
    const other = await addPage("/b")
    const versionId = await t.mutation(
      internal.publishing.markLive,
      release({ pageId: other })
    )
    await expect(
      ed.query(internal.publishing.rollbackContext, {
        siteId,
        pageId,
        versionId,
      })
    ).rejects.toEqual(errorCode("not_found"))
  })
})

describe("publishing.markLive", () => {
  test("records the version, points the page at it and audits", async () => {
    const { t, pageId, release, page, registry } = await site()
    await t.run((ctx) =>
      ctx.db.patch("pages", pageId, { draftHtml: "<p>draft</p>" })
    )
    const versionId = await t.mutation(
      internal.publishing.markLive,
      release({ forms: [contact("email")] })
    )

    expect(await page()).toMatchObject({
      liveVersionId: versionId,
      draftHtml: '<p data-r2c2-id="a">draft</p>',
    })
    const state = await t.run(async (ctx) => ({
      version: await ctx.db.get("pageVersions", versionId),
      log: await ctx.db.query("auditLog").collect(),
    }))
    expect(state.version).toMatchObject({
      hash: "h1",
      cssHash: "c1",
      publishedBy: "ed",
    })
    expect(state.log.at(-1)).toMatchObject({
      action: "page.publish",
      target: "/",
      actor: "ed",
    })
    expect(await registry()).toEqual([
      expect.objectContaining(contact("email")),
    ])
  })

  test("records a publish snapshot of the draft it published, even right after a save", async () => {
    const { t, siteId, ed, pageId, release } = await site()
    await ed.mutation(api.pages.saveDraft, {
      siteId,
      pageId,
      draftHtml: "<p>draft</p>",
    })
    await t.mutation(internal.publishing.markLive, release())

    const snapshots = await t.run((ctx) => draftHistory(ctx, pageId))
    expect(snapshots.map((s) => [s.reason, s.draftHtml])).toEqual([
      ["publish", "<p>draft</p>"],
      ["save", "<p>draft</p>"],
    ])
  })

  test("keeps an edit saved while publish ran", async () => {
    const { t, pageId, release, page } = await site()
    await t.run((ctx) =>
      ctx.db.patch("pages", pageId, { draftHtml: "<p>newer</p>" })
    )
    const versionId = await t.mutation(internal.publishing.markLive, release())
    expect(await page()).toMatchObject({
      draftHtml: "<p>newer</p>",
      liveVersionId: versionId,
    })
  })

  test("reuses the version when the same release is published again, as the latest publish", async () => {
    vi.useFakeTimers()
    const { t, release } = await site()
    const first = await t.mutation(internal.publishing.markLive, release())
    vi.advanceTimersByTime(60_000)
    expect(
      await t.mutation(internal.publishing.markLive, release({ actor: "ann" }))
    ).toBe(first)
    const version = await t.run((ctx) => ctx.db.get("pageVersions", first))
    expect(version).toMatchObject({
      publishedBy: "ann",
      publishedAt: Date.now(),
    })
    vi.useRealTimers()
  })

  test("removes forms no longer on a live page", async () => {
    const { t, release, registry } = await site()
    await t.mutation(
      internal.publishing.markLive,
      release({ forms: [contact("email")] })
    )
    await t.mutation(internal.publishing.markLive, release({ hash: "h2" }))
    expect(await registry()).toEqual([])
  })

  test("refuses a form that clashes with another live page", async () => {
    const { t, addPage, release } = await site()
    const other = await addPage("/contact")
    await t.mutation(
      internal.publishing.markLive,
      release({ pageId: other, forms: [contact("email")] })
    )
    await expect(
      t.mutation(
        internal.publishing.markLive,
        release({ forms: [contact("phone")] })
      )
    ).rejects.toEqual(
      expect.objectContaining({
        data: { code: "form_conflict", form: "contact" },
      })
    )
  })
})

describe("publishing.markRolledBack", () => {
  test("points the page at an older version and resyncs its forms", async () => {
    const { t, siteId, pageId, release, page, registry } = await site()
    const first = await t.mutation(
      internal.publishing.markLive,
      release({ forms: [contact("email")] })
    )
    await t.mutation(internal.publishing.markLive, release({ hash: "h2" }))
    expect(await registry()).toEqual([])

    await t.mutation(internal.publishing.markRolledBack, {
      siteId,
      pageId,
      versionId: first,
      actor: "ed",
    })
    expect((await page())?.liveVersionId).toBe(first)
    expect(await registry()).toEqual([
      expect.objectContaining(contact("email")),
    ])
    const log = await t.run((ctx) => ctx.db.query("auditLog").collect())
    expect(log.at(-1)).toMatchObject({ action: "page.rollback", target: "/" })
  })

  test("refuses another page's version", async () => {
    const { t, siteId, pageId, addPage, release } = await site()
    const other = await addPage("/b")
    const versionId = await t.mutation(
      internal.publishing.markLive,
      release({ pageId: other })
    )
    await expect(
      t.mutation(internal.publishing.markRolledBack, {
        siteId,
        pageId,
        versionId,
        actor: "ed",
      })
    ).rejects.toEqual(errorCode("not_found"))
  })

  test("refuses a rollback that would clash with another live page", async () => {
    const { t, siteId, pageId, addPage, release } = await site()
    const first = await t.mutation(
      internal.publishing.markLive,
      release({ forms: [contact("email")] })
    )
    await t.mutation(internal.publishing.markLive, release({ hash: "h2" }))
    const other = await addPage("/contact")
    await t.mutation(
      internal.publishing.markLive,
      release({ pageId: other, forms: [contact("phone")] })
    )

    await expect(
      t.mutation(internal.publishing.markRolledBack, {
        siteId,
        pageId,
        versionId: first,
        actor: "ed",
      })
    ).rejects.toEqual(
      expect.objectContaining({
        data: { code: "form_conflict", form: "contact" },
      })
    )
  })
})
