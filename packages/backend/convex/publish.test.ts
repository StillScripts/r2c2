import { elementsKey, liveKey, versionKey } from "@workspace/core"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test"
import { api } from "./_generated/api"
import { addSite, setup } from "../test/setup"

const writes = vi.hoisted(() => [] as { key: string; metadata?: object }[])
const stored = vi.hoisted(() => new Map<string, string>())

vi.mock("./storage", () => ({
  putObject: async (
    key: string,
    body: string,
    _type: string,
    metadata?: object
  ) => {
    writes.push({ key, metadata })
    stored.set(key, body)
    return key
  },
  objectExists: async (key: string) => stored.has(key),
  getObjectText: async (key: string) => stored.get(key)!,
}))

const DRAFT = `<html lang="en"><head><title>Home</title><meta name="description" content="Hi"></head><body><h1>Hello</h1></body></html>`

async function site() {
  const t = setup()
  const siteId = await addSite(t, "a", { userId: "ed", role: "editor" })
  const ed = t.withIdentity({ subject: "ed" })
  const pageId = await ed.mutation(api.pages.create, {
    siteId,
    path: "/",
    title: "Home",
  })
  const save = (draftHtml: string) =>
    ed.mutation(api.pages.saveDraft, { siteId, pageId, draftHtml })
  await save(DRAFT)
  return { t, siteId, ed, pageId, save }
}

const FORM = `<site-form name="contact"><form method="post" action="/_api/forms/contact"><label for="e">Email</label><input id="e" name="email" type="email"><button type="submit">Send</button></form></site-form>`

beforeEach(() => {
  writes.length = 0
  stored.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("publish", () => {
  test("writes CSS, version, then the live copy, and marks it live", async () => {
    const { t, siteId, ed, pageId } = await site()
    const result = await ed.action(api.publish.publish, { siteId, pageId })
    if (!result.ok) throw new Error(JSON.stringify(result.errors))

    const version = await t.run((ctx) =>
      ctx.db.get("pageVersions", result.versionId)
    )
    expect(writes.map((w) => w.key)).toEqual([
      expect.stringMatching(
        new RegExp(`^sites/${siteId}/assets/${version!.cssHash}\\.css$`)
      ),
      versionKey(siteId, version!.hash),
      liveKey(siteId, "/"),
    ])
    expect(writes.at(-1)?.metadata).toEqual({
      page: pageId,
      hash: version!.hash,
    })
    expect(stored.get(liveKey(siteId, "/"))).toMatch(/^<!doctype html>/)
  })

  test("returns house-rule errors without writing anything", async () => {
    const { siteId, ed, pageId, save } = await site()
    await save("<p hidden>x</p>")
    const result = await ed.action(api.publish.publish, { siteId, pageId })
    expect(result.ok).toBe(false)
    expect(writes).toEqual([])
  })

  test("rollback copies the older version back to the live key", async () => {
    const { siteId, ed, pageId, save } = await site()
    const first = await ed.action(api.publish.publish, { siteId, pageId })
    await save(DRAFT.replace("Hello", "Hello again"))
    await ed.action(api.publish.publish, { siteId, pageId })
    if (!first.ok) throw new Error("first publish failed")

    await ed.action(api.publish.rollback, {
      siteId,
      pageId,
      versionId: first.versionId,
    })
    expect(stored.get(liveKey(siteId, "/"))).toContain("<h1")
    expect(stored.get(liveKey(siteId, "/"))).not.toContain("Hello again")
    const page = await ed.query(api.pages.get, { siteId, pageId })
    expect(page.liveVersionId).toBe(first.versionId)
  })

  test("uploads the elements script once for pages with a form", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "1x00000000000000000000AA")
    const { siteId, ed, pageId, save } = await site()
    await save(DRAFT.replace("<h1>Hello</h1>", FORM))
    const result = await ed.action(api.publish.publish, { siteId, pageId })
    expect(result.ok).toBe(true)

    const script = writes.find((w) => w.key.startsWith("shared/elements/"))!.key
    const hash = script.slice("shared/elements/".length, -".js".length)
    expect(script).toBe(elementsKey(hash))
    expect(stored.get(liveKey(siteId, "/"))).toContain(
      `src="/_elements/${hash}.js"`
    )

    writes.length = 0
    await save(DRAFT.replace("<h1>Hello</h1>", FORM.replace("Send", "Go")))
    await ed.action(api.publish.publish, { siteId, pageId })
    expect(writes.some((w) => w.key === script)).toBe(false)
  })

  test("lets go of the page however it ends", async () => {
    const { t, siteId, ed, pageId, save } = await site()
    const claims = () => t.run((ctx) => ctx.db.query("pageClaims").collect())
    const first = await ed.action(api.publish.publish, { siteId, pageId })
    expect(await claims()).toEqual([])

    await save("<p hidden>x</p>")
    await ed.action(api.publish.publish, { siteId, pageId })
    expect(await claims()).toEqual([])

    if (!first.ok) throw new Error("first publish failed")
    await ed.action(api.publish.rollback, {
      siteId,
      pageId,
      versionId: first.versionId,
    })
    expect(await claims()).toEqual([])
  })

  test("refuses a form when no sitekey is set", async () => {
    const { siteId, ed, pageId, save } = await site()
    await save(DRAFT.replace("<h1>Hello</h1>", FORM))
    const result = await ed.action(api.publish.publish, { siteId, pageId })
    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ rule: "sitekey" })],
    })
    expect(writes).toEqual([])
  })
})
