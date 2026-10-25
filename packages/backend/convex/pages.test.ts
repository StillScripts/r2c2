import { MAX_PAGE_BYTES } from "@workspace/core"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { draftHistory, recordDraft, SNAPSHOT_INTERVAL_MS } from "./history"
import { addSite, errorCode, setup } from "../test/setup"

async function editorSite() {
  const t = setup()
  const siteId = await addSite(t, "a", { userId: "ed", role: "editor" })
  const ed = t.withIdentity({ subject: "ed" })
  const pageId = await ed.mutation(api.pages.create, {
    siteId,
    path: "/About",
    title: "About us",
  })
  return { t, siteId, ed, pageId }
}

const snapshots = (t: ReturnType<typeof setup>, pageId: Id<"pages">) =>
  t.run(async (ctx) => (await draftHistory(ctx, pageId)).page)

afterEach(() => {
  vi.useRealTimers()
})

describe("pages", () => {
  test("an editor creates a page with a starter draft, audited", async () => {
    const { t, siteId, ed, pageId } = await editorSite()

    const page = await ed.query(api.pages.get, { siteId, pageId })
    expect(page).toMatchObject({ path: "/about", title: "About us" })
    expect(page.draftHtml).toContain("<title>About us</title>")
    const log = await t.run((ctx) => ctx.db.query("auditLog").collect())
    expect(log).toEqual([
      expect.objectContaining({ action: "page.create", target: "/about" }),
    ])
  })

  test("escapes the title in the starter draft", async () => {
    const { siteId, ed } = await editorSite()
    const pageId = await ed.mutation(api.pages.create, {
      siteId,
      path: "/x",
      title: "<b>Fish & chips</b>",
    })
    const page = await ed.query(api.pages.get, { siteId, pageId })
    expect(page.draftHtml).toContain(
      "<title>&lt;b&gt;Fish &amp; chips&lt;/b&gt;</title>"
    )
  })

  test.each([
    ["invalid_path", "/about us"],
    ["path_taken", "/about"],
  ])("refuses to create with %s", async (code, path) => {
    const { siteId, ed } = await editorSite()
    await expect(
      ed.mutation(api.pages.create, { siteId, path, title: "x" })
    ).rejects.toEqual(errorCode(code))
  })

  test("refuses outsiders and signed-out callers", async () => {
    const { t, siteId } = await editorSite()
    const args = { siteId, path: "/new", title: "New" }
    await expect(
      t.withIdentity({ subject: "eve" }).mutation(api.pages.create, args)
    ).rejects.toEqual(errorCode("not_found"))
    await expect(t.mutation(api.pages.create, args)).rejects.toEqual(
      errorCode("unauthenticated")
    )
  })

  test("lists only the site's pages, by path", async () => {
    const { t, siteId, ed } = await editorSite()
    await ed.mutation(api.pages.create, { siteId, path: "/", title: "Home" })
    const other = await addSite(t, "b", { userId: "ed", role: "owner" })
    await ed.mutation(api.pages.create, {
      siteId: other,
      path: "/b",
      title: "B",
    })

    expect(await ed.query(api.pages.list, { siteId })).toEqual([
      expect.objectContaining({ path: "/", title: "Home", isLive: false }),
      expect.objectContaining({ path: "/about", title: "About us" }),
    ])
  })

  test("saving updates the draft and takes the title from it", async () => {
    const { siteId, ed, pageId } = await editorSite()
    const draftHtml = "<html><head><title>Who we are</title></head></html>"
    await ed.mutation(api.pages.saveDraft, { siteId, pageId, draftHtml })

    expect(await ed.query(api.pages.get, { siteId, pageId })).toMatchObject({
      draftHtml,
      title: "Who we are",
    })
  })

  test("saving keeps the title when the draft has none", async () => {
    const { siteId, ed, pageId } = await editorSite()
    await ed.mutation(api.pages.saveDraft, { siteId, pageId, draftHtml: "<p>" })
    expect(await ed.query(api.pages.get, { siteId, pageId })).toMatchObject({
      title: "About us",
    })
  })

  test("refuses another site's page and oversized drafts", async () => {
    const { t, siteId, ed, pageId } = await editorSite()
    const other = await addSite(t, "b", { userId: "ed", role: "owner" })
    await expect(
      ed.mutation(api.pages.saveDraft, { siteId: other, pageId, draftHtml: "" })
    ).rejects.toEqual(errorCode("not_found"))
    await expect(
      ed.mutation(api.pages.saveDraft, {
        siteId,
        pageId,
        draftHtml: "a".repeat(MAX_PAGE_BYTES + 1),
      })
    ).rejects.toEqual(errorCode("page_too_large"))
  })
})

describe("draft history", () => {
  test("creating a page records no snapshot", async () => {
    const { t, pageId } = await editorSite()
    expect(await snapshots(t, pageId)).toEqual([])
  })

  test("saves record at most one snapshot every five minutes", async () => {
    vi.useFakeTimers()
    const { t, siteId, ed, pageId } = await editorSite()
    const save = (draftHtml: string) =>
      ed.mutation(api.pages.saveDraft, { siteId, pageId, draftHtml })

    await save("<p>one</p>")
    vi.advanceTimersByTime(SNAPSHOT_INTERVAL_MS - 1000)
    await save("<p>two</p>")
    expect(await snapshots(t, pageId)).toEqual([
      expect.objectContaining({
        doc: expect.objectContaining({ draftHtml: "<p>one</p>" }),
        attribution: { reason: "save", actor: "ed" },
      }),
    ])

    vi.advanceTimersByTime(2000)
    await save("<p>three</p>")
    expect((await snapshots(t, pageId)).map((s) => s.doc.draftHtml)).toEqual([
      "<p>three</p>",
      "<p>one</p>",
    ])
  })

  test.each(["publish", "restore", "ai-edit"] as const)(
    "%s always records, even right after a save",
    async (reason) => {
      vi.useFakeTimers()
      const { t, siteId, ed, pageId } = await editorSite()
      await ed.mutation(api.pages.saveDraft, { siteId, pageId, draftHtml: "" })

      await t.run(async (ctx) => {
        const page = await ctx.db.get("pages", pageId)
        await recordDraft(ctx, page!, { reason, actor: "system" })
      })
      expect(await snapshots(t, pageId)).toHaveLength(2)
    }
  )
})
