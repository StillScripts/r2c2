import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { api } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { ACTIVITY_LIMIT, SEEN_REFRESH_MS, VISIT_GAP_MS } from "./home"
import { addSite, errorCode, setup } from "../test/setup"

afterEach(() => {
  vi.useRealTimers()
})

const seen = (t: ReturnType<typeof setup>) =>
  t.run(async (ctx) => {
    const row = await ctx.db.query("visits").first()
    return { lastSeenAt: row?.lastSeenAt, previousSeenAt: row?.previousSeenAt }
  })

const log = (
  t: ReturnType<typeof setup>,
  siteId: Id<"sites">,
  action: string,
  target: string,
  at: number
) =>
  t.run((ctx) =>
    ctx.db.insert("auditLog", { siteId, actor: "ann", action, target, at })
  )

const enquiry = (
  t: ReturnType<typeof setup>,
  siteId: Id<"sites">,
  form: string,
  createdAt: number
) =>
  t.run((ctx) =>
    ctx.db.insert("enquiries", {
      siteId,
      form,
      data: {},
      status: "new",
      createdAt,
      bodyHash: `${form}${createdAt}`,
    })
  )

describe("home.markSeen", () => {
  test("refreshes now and then within a visit, and starts a new one after a long gap", async () => {
    vi.useFakeTimers({ now: 1_000_000 })
    const t = setup()
    const ann = t.withIdentity({ subject: "ann" })

    await ann.mutation(api.home.markSeen, {})
    expect(await seen(t)).toEqual({ lastSeenAt: 1_000_000 })

    vi.setSystemTime(1_000_000 + 60_000)
    await ann.mutation(api.home.markSeen, {})
    expect(await seen(t)).toEqual({ lastSeenAt: 1_000_000 })

    const refreshed = 1_000_000 + SEEN_REFRESH_MS + 1
    vi.setSystemTime(refreshed)
    await ann.mutation(api.home.markSeen, {})
    expect(await seen(t)).toEqual({ lastSeenAt: refreshed })

    const later = refreshed + VISIT_GAP_MS + 1
    vi.setSystemTime(later)
    await ann.mutation(api.home.markSeen, {})
    expect(await seen(t)).toEqual({
      lastSeenAt: later,
      previousSeenAt: refreshed,
    })
  })

  test("leaves preferences alone, so it doesn't re-run staff.me", async () => {
    const t = setup()
    await t.withIdentity({ subject: "ann" }).mutation(api.home.markSeen, {})
    expect(await t.run((ctx) => ctx.db.query("preferences").collect())).toEqual(
      []
    )
  })

  test("refuses signed-out callers", async () => {
    await expect(setup().mutation(api.home.markSeen, {})).rejects.toEqual(
      errorCode("unauthenticated")
    )
  })
})

describe("home.overview", () => {
  async function twoSites() {
    const t = setup()
    const a = await addSite(t, "a", { userId: "ann", role: "owner" })
    const b = await addSite(t, "b", { userId: "ann", role: "editor" })
    await addSite(t, "other", { userId: "bob", role: "owner" })
    return { t, a, b, ann: t.withIdentity({ subject: "ann" }) }
  }

  test("lists only the caller's sites, with their address and status", async () => {
    const { ann } = await twoSites()
    const { sites } = await ann.query(api.home.overview, {})
    expect(sites).toEqual([
      expect.objectContaining({
        name: "a",
        address: "a.localhost",
        status: "live",
        role: "owner",
        newEnquiries: 0,
      }),
      expect.objectContaining({ name: "b", role: "editor" }),
    ])
  })

  test("merges activity across sites, newest first, without naming anyone", async () => {
    const { t, a, b, ann } = await twoSites()
    await log(t, a, "page.publish", "/pricing", 10)
    await log(t, b, "page.create", "/new", 20)
    await log(t, a, "site.rename", "a", 30)
    await log(t, b, "page.rollback", "/", 40)
    await log(t, a, "page.restore", "/how", 50)
    await enquiry(t, a, "contact", 60)
    await enquiry(t, a, "contact", 15)

    const { activity } = await ann.query(api.home.overview, {})
    expect(activity).toHaveLength(ACTIVITY_LIMIT)
    expect(activity).toEqual([
      expect.objectContaining({ kind: "enquiry", form: "contact", count: 2 }),
      expect.objectContaining({
        kind: "page",
        action: "page.restore",
        path: "/how",
        siteName: "a",
      }),
      expect.objectContaining({
        kind: "page",
        action: "page.rollback",
        path: "/",
        siteName: "b",
      }),
      expect.objectContaining({
        kind: "page",
        action: "page.create",
        path: "/new",
        siteName: "b",
      }),
    ])
    expect(JSON.stringify(activity)).not.toContain("ann")
  })

  test("summarises what changed since the previous visit, and the drafts waiting", async () => {
    const { t, a, ann } = await twoSites()
    await t.run((ctx) =>
      ctx.db.insert("visits", {
        userId: "ann",
        lastSeenAt: 110,
        previousSeenAt: 100,
      })
    )
    await log(t, a, "page.publish", "/old", 50)
    await log(t, a, "page.publish", "/pricing", 150)
    await log(t, a, "page.publish", "/pricing", 160)
    await enquiry(t, a, "contact", 90)
    await enquiry(t, a, "contact", 120)
    const pageId = await t.run((ctx) =>
      ctx.db.insert("pages", {
        siteId: a,
        path: "/how",
        title: "How",
        draftHtml: "",
        draftChangedAt: 130,
      })
    )

    const { summary, sites } = await ann.query(api.home.overview, {})
    expect(summary).toEqual({
      firstVisit: false,
      published: ["/pricing"],
      newEnquiries: 1,
      drafts: [{ siteId: a, pageId, path: "/how", at: 130 }],
    })
    expect(sites[0]?.newEnquiries).toBe(2)
  })

  test("links a page row to its page while it exists", async () => {
    const { t, a, ann } = await twoSites()
    const pageId = await t.run((ctx) =>
      ctx.db.insert("pages", {
        siteId: a,
        path: "/",
        title: "Home",
        draftHtml: "",
      })
    )
    await log(t, a, "page.publish", "/", 10)
    await log(t, a, "page.publish", "/gone", 20)
    const { activity } = await ann.query(api.home.overview, {})
    expect(activity.map((row) => row.kind === "page" && row.pageId)).toEqual([
      undefined,
      pageId,
    ])
  })

  test("is a first visit with no previous visit", async () => {
    const { ann } = await twoSites()
    expect((await ann.query(api.home.overview, {})).summary).toMatchObject({
      firstVisit: true,
      published: [],
      newEnquiries: 0,
    })
  })
})
