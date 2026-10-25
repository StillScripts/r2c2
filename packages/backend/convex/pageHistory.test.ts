import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test"
import { api, internal } from "./_generated/api"
import { addSite, errorCode, setup } from "../test/setup"

beforeEach(() => {
  vi.stubEnv("SITE_URL", "http://localhost:3000")
  vi.stubEnv("BETTER_AUTH_SECRET", "a-test-secret-that-is-long-enough")
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

/** A site whose owner is a real Better Auth user named Ann, with one page. */
async function site() {
  const t = setup()
  const siteId = await addSite(t, "r2c2")
  const { userId } = await t.action(internal.staff.create, {
    email: "ann@r2c2.dev",
    name: "Ann",
    password: "correct-horse",
  })
  const ann = t.withIdentity({ subject: userId })
  const pageId = await ann.mutation(api.pages.create, {
    siteId,
    path: "/",
    title: "Home",
  })
  const save = (draftHtml: string) =>
    ann.mutation(api.pages.saveDraft, { siteId, pageId, draftHtml })
  const markLive = (hash: string, actor = userId) =>
    t.mutation(internal.publishing.markLive, {
      siteId,
      pageId,
      actor,
      draftHtml: "",
      draftWithIds: "",
      hash,
      cssHash: "c",
      forms: [],
    })
  return { t, siteId, ann, pageId, save, markLive }
}

describe("pages.versions", () => {
  test("lists versions newest first, with their author", async () => {
    vi.useFakeTimers()
    const { siteId, ann, pageId, markLive } = await site()
    const first = await markLive("h1")
    vi.advanceTimersByTime(1000)
    const second = await markLive("h2", "system")

    expect(await ann.query(api.pages.versions, { siteId, pageId })).toEqual([
      expect.objectContaining({ _id: second, publishedBy: "System" }),
      expect.objectContaining({ _id: first, publishedBy: "Ann" }),
    ])
  })

  test("refuses outsiders", async () => {
    const { t, siteId, pageId } = await site()
    await expect(
      t
        .withIdentity({ subject: "eve" })
        .query(api.pages.versions, { siteId, pageId })
    ).rejects.toEqual(errorCode("not_found"))
  })
})

describe("pages.history and pages.snapshot", () => {
  test("list snapshots with their reason and author, and return one's draft", async () => {
    const { siteId, ann, pageId, save } = await site()
    await save("<p>one</p>")
    const history = await ann.query(api.pages.history, { siteId, pageId })
    expect(history).toEqual([
      expect.objectContaining({ reason: "save", author: "Ann" }),
    ])
    expect(
      await ann.query(api.pages.snapshot, {
        siteId,
        pageId,
        ts: history[0]!.ts,
      })
    ).toBe("<p>one</p>")
  })

  test("refuse a snapshot that doesn't exist", async () => {
    const { siteId, ann, pageId } = await site()
    await expect(
      ann.query(api.pages.snapshot, { siteId, pageId, ts: 1 })
    ).rejects.toEqual(errorCode("not_found"))
  })
})

describe("pages.restoreDraft", () => {
  test("puts a snapshot back and records the draft it replaced", async () => {
    const { siteId, ann, pageId, save } = await site()
    const two = "<html><head><title>Two</title></head></html>"
    await save("<p>one</p>")
    const [one] = await ann.query(api.pages.history, { siteId, pageId })
    await save(two)

    await ann.mutation(api.pages.restoreDraft, { siteId, pageId, ts: one!.ts })
    expect(await ann.query(api.pages.get, { siteId, pageId })).toMatchObject({
      draftHtml: "<p>one</p>",
      title: "Two",
    })
    const [replaced] = await ann.query(api.pages.history, { siteId, pageId })
    expect(replaced).toMatchObject({ reason: "restore" })
    expect(
      await ann.query(api.pages.snapshot, { siteId, pageId, ts: replaced!.ts })
    ).toBe(two)

    // The restore can itself be undone
    await ann.mutation(api.pages.restoreDraft, {
      siteId,
      pageId,
      ts: replaced!.ts,
    })
    expect((await ann.query(api.pages.get, { siteId, pageId })).draftHtml).toBe(
      two
    )
  })

  test("refuses a snapshot from another page", async () => {
    const { siteId, ann, pageId, save } = await site()
    await save("<p>one</p>")
    const [snapshot] = await ann.query(api.pages.history, { siteId, pageId })
    const other = await ann.mutation(api.pages.create, {
      siteId,
      path: "/b",
      title: "B",
    })
    await expect(
      ann.mutation(api.pages.restoreDraft, {
        siteId,
        pageId: other,
        ts: snapshot!.ts,
      })
    ).rejects.toEqual(errorCode("not_found"))
  })
})
