import {
  ENQUIRY_INTAKE_PATH,
  MAX_ENQUIRY_BYTES,
  signedHeaders,
} from "@workspace/core"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test"
import type { FormField } from "@workspace/html"
import type { Id } from "../convex/_generated/dataModel"
import type { EnquiryStatus } from "./validators"
import { api } from "./_generated/api"
import { addSite, errorCode, scheduled, setup } from "../test/setup"

type T = ReturnType<typeof setup>

const SECRET = "test-secret"
const FIELDS: FormField[] = [
  { name: "name", type: "text", required: true, maxLength: 20 },
  { name: "email", type: "email", required: true },
  { name: "message", type: "textarea", required: false },
]
const valid = { name: "Ada", email: "ada@example.com", message: "Hello" }

beforeEach(() => {
  vi.stubEnv("R2C2_SIGNING_SECRET", SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const addForm = (t: T, siteId: Id<"sites">) =>
  t.run((ctx) =>
    ctx.db.insert("forms", { siteId, name: "contact", fields: FIELDS })
  )

async function siteWithForm() {
  const t = setup()
  const siteId = await addSite(t, "a")
  await addForm(t, siteId)
  return { t, siteId }
}

type Options = {
  siteId: string
  secret?: string
  signAt?: number
  header?: string
  send?: string
}

async function post(t: T, body: string, options: Options) {
  const headers = await signedHeaders(
    options.secret ?? SECRET,
    { siteId: options.siteId, method: "POST", path: ENQUIRY_INTAKE_PATH, body },
    options.signAt ?? Date.now()
  )
  if (options.header) headers["x-r2c2-site"] = options.header
  return t.fetch(ENQUIRY_INTAKE_PATH, {
    method: "POST",
    headers,
    body: options.send ?? body,
  })
}

const enquiry = (data: Record<string, string>, extra: object = {}) =>
  JSON.stringify({ form: "contact", data, ...extra })

const stored = (t: T) => t.run((ctx) => ctx.db.query("enquiries").collect())

describe("enquiry intake", () => {
  test("stores a signed, valid enquiry", async () => {
    const { t, siteId } = await siteWithForm()
    const source = { page: "/contact", utm: { utm_source: "news" } }
    const response = await post(t, enquiry(valid, { source }), { siteId })

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })
    expect(await stored(t)).toEqual([
      expect.objectContaining({
        siteId,
        form: "contact",
        data: valid,
        source,
        status: "new",
        bodyHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    ])
    const [{ _id: enquiryId }] = await stored(t)
    expect(await scheduled(t)).toEqual([
      ["notifications:enquiryEmail", { enquiryId, replyTo: "ada@example.com" }],
    ])
  })

  test("stores a no-JS post without a source", async () => {
    const { t, siteId } = await siteWithForm()
    expect((await post(t, enquiry(valid), { siteId })).status).toBe(201)
    expect((await stored(t))[0]?.source).toBeUndefined()
  })

  test.each([
    ["the wrong secret", { secret: "nope" }],
    ["a signature older than 60s", { signAt: Date.now() - 61_000 }],
    ["a site header the signature doesn't cover", { header: "other" }],
  ])("refuses %s", async (_, options) => {
    const { t, siteId } = await siteWithForm()
    const response = await post(t, enquiry(valid), { siteId, ...options })
    expect(response.status).toBe(401)
    expect(await stored(t)).toEqual([])
    expect(await scheduled(t)).toEqual([])
  })

  test("refuses unsigned and tampered requests", async () => {
    const { t, siteId } = await siteWithForm()
    const unsigned = await t.fetch(ENQUIRY_INTAKE_PATH, {
      method: "POST",
      body: enquiry(valid),
    })
    expect(unsigned.status).toBe(401)

    const tampered = await post(t, enquiry(valid), {
      siteId,
      send: enquiry({ ...valid, name: "Eve" }),
    })
    expect(tampered.status).toBe(401)
  })

  test("is unavailable without a signing secret", async () => {
    const { t, siteId } = await siteWithForm()
    vi.stubEnv("R2C2_SIGNING_SECRET", "")
    expect((await post(t, enquiry(valid), { siteId })).status).toBe(503)
  })

  test("refuses bodies over 32 KB", async () => {
    const { t, siteId } = await siteWithForm()
    const big = enquiry({ ...valid, message: "x".repeat(MAX_ENQUIRY_BYTES) })
    expect((await post(t, big, { siteId })).status).toBe(413)
  })

  test.each([
    ["malformed JSON", "{"],
    ["the wrong shape", JSON.stringify({ data: valid })],
  ])("rejects %s", async (_, body) => {
    const { t, siteId } = await siteWithForm()
    const response = await post(t, body, { siteId })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      ok: false,
      errors: { body: ["Invalid enquiry."] },
    })
  })

  test("returns 404 for a site ID that isn't one", async () => {
    const { t } = await siteWithForm()
    const response = await post(t, enquiry(valid), { siteId: "not-a-site" })
    expect(response.status).toBe(404)
  })

  test("returns 404 for a deleted site", async () => {
    const { t, siteId } = await siteWithForm()
    await t.run((ctx) => ctx.db.delete("sites", siteId))
    expect((await post(t, enquiry(valid), { siteId })).status).toBe(404)
  })

  test.each([
    [
      "an unknown form",
      JSON.stringify({ form: "other", data: valid }),
      { form: ["Unknown form."] },
    ],
    [
      "an extra field",
      enquiry({ ...valid, phone: "1" }),
      { phone: ["Unexpected field."] },
    ],
    [
      "a blank required field",
      enquiry({ ...valid, name: "  " }),
      { name: ["Required."] },
    ],
    [
      "a missing required field",
      enquiry({ name: "Ada" }),
      { email: ["Required."] },
    ],
    [
      "a value over maxLength",
      enquiry({ ...valid, name: "x".repeat(21) }),
      { name: ["Too long (max 20)."] },
    ],
    [
      "a bad email",
      enquiry({ ...valid, email: "ada" }),
      { email: ["Enter a valid email."] },
    ],
  ])("rejects %s with field errors", async (_, body, errors) => {
    const { t, siteId } = await siteWithForm()
    const response = await post(t, body, { siteId })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ ok: false, errors })
    expect(await stored(t)).toEqual([])
  })

  test("drops duplicates within 10 minutes, whatever the field order", async () => {
    const { t, siteId } = await siteWithForm()
    const reordered = Object.fromEntries(Object.entries(valid).reverse())
    expect((await post(t, enquiry(valid), { siteId })).status).toBe(201)
    expect((await post(t, enquiry(reordered), { siteId })).status).toBe(201)
    expect(await stored(t)).toHaveLength(1)
    expect(await scheduled(t)).toHaveLength(1)

    await t.run(async (ctx) => {
      const [row] = await ctx.db.query("enquiries").collect()
      await ctx.db.patch("enquiries", row!._id, {
        createdAt: row!.createdAt - 10 * 60_000 - 1,
      })
    })
    expect((await post(t, enquiry(valid), { siteId })).status).toBe(201)
    expect(await stored(t)).toHaveLength(2)
  })

  test("rate limits per site, not counting duplicates", async () => {
    const { t, siteId } = await siteWithForm()
    const other = await addSite(t, "b")
    await addForm(t, other)
    const send = (site: string, n: number) =>
      post(t, enquiry({ ...valid, message: `m${n}` }), { siteId: site })

    for (let n = 0; n < 40; n++)
      expect((await send(siteId, n)).status).toBe(201)
    expect((await send(siteId, 0)).status).toBe(201)
    expect((await send(siteId, 40)).status).toBe(429)
    expect((await send(other, 0)).status).toBe(201)
  })
})

describe("enquiries inbox", () => {
  async function inbox() {
    const t = setup()
    const siteId = await addSite(t, "inbox", { userId: "ed", role: "editor" })
    const ed = t.withIdentity({ subject: "ed" })
    const add = (status: EnquiryStatus, createdAt: number, site = siteId) =>
      t.run((ctx) =>
        ctx.db.insert("enquiries", {
          siteId: site,
          form: "contact",
          data: { name: `at ${createdAt}` },
          status,
          createdAt,
          bodyHash: `${createdAt}`,
        })
      )
    return { t, siteId, ed, add }
  }

  test("lists a status newest first and counts new enquiries", async () => {
    const { siteId, ed, add } = await inbox()
    await add("new", 1)
    await add("new", 3)
    await add("handled", 2)

    const fresh = await ed.query(api.enquiries.list, { siteId, status: "new" })
    expect(fresh.enquiries.map((e) => e.createdAt)).toEqual([3, 1])
    expect(fresh.capped).toBe(false)
    const handled = await ed.query(api.enquiries.list, {
      siteId,
      status: "handled",
    })
    expect(handled.enquiries.map((e) => e.createdAt)).toEqual([2])
    expect(await ed.query(api.enquiries.newCount, { siteId })).toEqual({
      count: 2,
      capped: false,
    })
  })

  test("says when a tab holds more than it shows", async () => {
    const { siteId, ed, add } = await inbox()
    for (let n = 0; n < 101; n++) await add("new", n)

    const fresh = await ed.query(api.enquiries.list, { siteId, status: "new" })
    expect(fresh.enquiries).toHaveLength(100)
    expect(fresh.capped).toBe(true)
    expect(await ed.query(api.enquiries.newCount, { siteId })).toEqual({
      count: 100,
      capped: true,
    })
  })

  test("an editor marks an enquiry handled and reopens it, audited", async () => {
    const { t, siteId, ed, add } = await inbox()
    const enquiryId = await add("new", 1)

    await ed.mutation(api.enquiries.setStatus, {
      siteId,
      enquiryId,
      status: "handled",
    })
    await ed.mutation(api.enquiries.setStatus, {
      siteId,
      enquiryId,
      status: "handled",
    })
    expect(
      (await ed.query(api.enquiries.get, { siteId, enquiryId })).status
    ).toBe("handled")
    await ed.mutation(api.enquiries.setStatus, {
      siteId,
      enquiryId,
      status: "new",
    })

    const log = await t.run((ctx) => ctx.db.query("auditLog").collect())
    expect(log.map((entry) => [entry.action, entry.target])).toEqual([
      ["enquiry.handled", enquiryId],
      ["enquiry.reopened", enquiryId],
    ])
  })

  test("hides another site's enquiries and refuses non-members", async () => {
    const { t, siteId, ed, add } = await inbox()
    const foreign = await add("new", 1, await addSite(t, "other"))

    await expect(
      ed.query(api.enquiries.get, { siteId, enquiryId: foreign })
    ).rejects.toEqual(errorCode("not_found"))
    await expect(
      ed.mutation(api.enquiries.setStatus, {
        siteId,
        enquiryId: foreign,
        status: "handled",
      })
    ).rejects.toEqual(errorCode("not_found"))
    await expect(
      t
        .withIdentity({ subject: "stranger" })
        .query(api.enquiries.list, { siteId, status: "new" })
    ).rejects.toEqual(errorCode("not_found"))
  })
})
