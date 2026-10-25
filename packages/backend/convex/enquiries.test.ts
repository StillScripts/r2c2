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
import { addSite, setup } from "../test/setup"

const SECRET = "test-secret"
const FIELDS = [
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

async function siteWithForm() {
  const t = setup()
  const siteId = await addSite(t, "a")
  await t.run((ctx) =>
    ctx.db.insert("forms", { siteId, name: "contact", fields: FIELDS })
  )
  return { t, siteId }
}

type Options = {
  siteId: string
  secret?: string
  signAt?: number
  header?: string
}

async function post(
  t: ReturnType<typeof setup>,
  body: string,
  options: Options
) {
  const headers = await signedHeaders(
    options.secret ?? SECRET,
    { siteId: options.siteId, method: "POST", path: ENQUIRY_INTAKE_PATH, body },
    options.signAt ?? Date.now()
  )
  if (options.header) headers["x-r2c2-site"] = options.header
  return t.fetch(ENQUIRY_INTAKE_PATH, { method: "POST", headers, body })
}

const enquiry = (data: Record<string, string>, extra: object = {}) =>
  JSON.stringify({ form: "contact", data, ...extra })

const stored = (t: ReturnType<typeof setup>) =>
  t.run((ctx) => ctx.db.query("enquiries").collect())

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
  })

  test("refuses unsigned and tampered requests", async () => {
    const { t, siteId } = await siteWithForm()
    const unsigned = await t.fetch(ENQUIRY_INTAKE_PATH, {
      method: "POST",
      body: enquiry(valid),
    })
    expect(unsigned.status).toBe(401)

    const headers = await signedHeaders(SECRET, {
      siteId,
      method: "POST",
      path: ENQUIRY_INTAKE_PATH,
      body: enquiry(valid),
    })
    const tampered = await t.fetch(ENQUIRY_INTAKE_PATH, {
      method: "POST",
      headers,
      body: enquiry({ ...valid, name: "Eve" }),
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

  test.each([
    ["a site ID that isn't one", "not-a-site"],
    ["a deleted site", "deleted"],
  ])("returns 404 for %s", async (_, kind) => {
    const { t, siteId } = await siteWithForm()
    if (kind === "deleted") await t.run((ctx) => ctx.db.delete("sites", siteId))
    const target = kind === "deleted" ? siteId : kind
    expect((await post(t, enquiry(valid), { siteId: target })).status).toBe(404)
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
    const reordered = {
      message: "Hello",
      email: "ada@example.com",
      name: "Ada",
    }
    expect((await post(t, enquiry(valid), { siteId })).status).toBe(201)
    expect((await post(t, enquiry(reordered), { siteId })).status).toBe(201)
    expect(await stored(t)).toHaveLength(1)

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
    await t.run((ctx) =>
      ctx.db.insert("forms", { siteId: other, name: "contact", fields: FIELDS })
    )
    const send = (site: string, n: number) =>
      post(t, enquiry({ ...valid, message: `m${n}` }), { siteId: site })

    for (let n = 0; n < 40; n++)
      expect((await send(siteId, n)).status).toBe(201)
    expect((await send(siteId, 0)).status).toBe(201)
    expect((await send(siteId, 40)).status).toBe(429)
    expect((await send(other, 0)).status).toBe(201)
  })
})
