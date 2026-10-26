import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { draftHistory } from "./history"
import { CLAIM_MS, formClash } from "./publishing"
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

afterEach(() => {
  vi.useRealTimers()
})

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

describe("publishing.claimPublish", () => {
  test("refuses outsiders and signed-out callers", async () => {
    const { t, siteId, pageId } = await site()
    await expect(
      t
        .withIdentity({ subject: "eve" })
        .mutation(internal.publishing.claimPublish, { siteId, pageId })
    ).rejects.toEqual(errorCode("not_found"))
    await expect(
      t.mutation(internal.publishing.claimPublish, { siteId, pageId })
    ).rejects.toEqual(errorCode("unauthenticated"))
  })

  test("builds the canonical URL from the primary domain", async () => {
    const { t, siteId, ed, addPage } = await site()
    const pageId = await addPage("/about")
    const claim = async () => {
      const context = await ed.mutation(internal.publishing.claimPublish, {
        siteId,
        pageId,
      })
      await t.mutation(internal.publishing.release, {
        claimId: context.claimId,
      })
      return context
    }
    expect((await claim()).canonicalUrl).toBeUndefined()

    await t.run((ctx) =>
      ctx.db.insert("domains", {
        siteId,
        hostname: "a.dev",
        kind: "primary",
        status: "active",
      })
    )
    expect(await claim()).toMatchObject({
      userId: "ed",
      canonicalUrl: "https://a.dev/about",
    })
  })

  test("refuses a second publish or rollback until the first lets go or expires", async () => {
    vi.useFakeTimers()
    const { t, siteId, ed, pageId, release } = await site()
    const versionId = await t.mutation(internal.publishing.markLive, release())
    const claim = () =>
      ed.mutation(internal.publishing.claimPublish, { siteId, pageId })

    const { claimId } = await claim()
    await expect(claim()).rejects.toEqual(errorCode("page_busy"))
    await expect(
      ed.mutation(internal.publishing.claimRollback, {
        siteId,
        pageId,
        versionId,
      })
    ).rejects.toEqual(errorCode("page_busy"))

    await t.mutation(internal.publishing.release, { claimId })
    await claim()
    vi.advanceTimersByTime(CLAIM_MS + 1000)
    await claim()
    expect(
      await t.run((ctx) => ctx.db.query("pageClaims").collect())
    ).toHaveLength(1)
  })

  test("refuses saves and restores while the page is claimed", async () => {
    const { t, siteId, ed, pageId } = await site()
    const save = () =>
      ed.mutation(api.pages.saveDraft, { siteId, pageId, draftHtml: "<p/>" })
    await save()
    const [{ ts }] = await t.run((ctx) => draftHistory(ctx, pageId))
    const { claimId } = await ed.mutation(internal.publishing.claimPublish, {
      siteId,
      pageId,
    })
    await expect(save()).rejects.toEqual(errorCode("page_busy"))
    await expect(
      ed.mutation(api.pages.restoreDraft, { siteId, pageId, ts })
    ).rejects.toEqual(errorCode("page_busy"))

    await t.mutation(internal.publishing.release, { claimId })
    await save()
  })
})

describe("publishing.holdForms", () => {
  async function claimed() {
    const fixture = await site()
    const { siteId, ed, addPage } = fixture
    const claim = async (pageId: Id<"pages">) =>
      (
        await ed.mutation(internal.publishing.claimPublish, {
          siteId,
          pageId,
        })
      ).claimId
    const hold = (claimId: Id<"pageClaims">, forms = [contact("email")]) =>
      fixture.t.mutation(internal.publishing.holdForms, { claimId, forms })
    return { ...fixture, other: await addPage("/contact"), claim, hold }
  }

  test("refuses a form defined differently on another live page", async () => {
    const { t, pageId, other, release, claim, hold } = await claimed()
    await t.mutation(
      internal.publishing.markLive,
      release({ pageId: other, forms: [contact("phone")] })
    )
    await expect(hold(await claim(pageId))).rejects.toEqual(
      errorCode("form_conflict", { form: "contact" })
    )
  })

  test("refuses a form defined differently on another page's claim", async () => {
    vi.useFakeTimers()
    const { pageId, other, claim, hold } = await claimed()
    await hold(await claim(other), [contact("phone")])
    const claimId = await claim(pageId)
    await expect(hold(claimId)).rejects.toEqual(
      errorCode("form_conflict", { form: "contact" })
    )

    vi.advanceTimersByTime(CLAIM_MS + 1000)
    await expect(hold(claimId)).rejects.toEqual(errorCode("page_busy"))
    await hold(await claim(pageId))
  })

  test("ignores the page's own live forms", async () => {
    const { t, pageId, release, claim, hold } = await claimed()
    await t.mutation(
      internal.publishing.markLive,
      release({ forms: [contact("phone")] })
    )
    await hold(await claim(pageId))
  })
})

describe("publishing.claimRollback", () => {
  test("refuses another page's version", async () => {
    const { t, siteId, ed, pageId, addPage, release } = await site()
    const other = await addPage("/b")
    const versionId = await t.mutation(
      internal.publishing.markLive,
      release({ pageId: other })
    )
    await expect(
      ed.mutation(internal.publishing.claimRollback, {
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
    ).rejects.toEqual(errorCode("form_conflict", { form: "contact" }))
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
    ).rejects.toEqual(errorCode("form_conflict", { form: "contact" }))
  })
})
