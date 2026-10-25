import { Resend } from "@convex-dev/resend"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { enquiryEmailText, TEST_INBOX } from "./notifications"
import { addSite, setup } from "../test/setup"

const send = vi.spyOn(Resend.prototype, "sendEmail")

beforeEach(() => {
  send.mockReset().mockResolvedValue("email-id" as never)
  vi.stubEnv("SITE_URL", "http://localhost:3000")
  vi.stubEnv("BETTER_AUTH_SECRET", "a-test-secret-that-is-long-enough")
  vi.stubEnv("EMAIL_FROM", "R2C2 <hello@r2c2.dev>")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const ENQUIRY = {
  form: "contact",
  data: { name: "Ada", email: "ada@example.com", message: "Hi" },
  source: { page: "/contact", utm: {} },
  createdAt: Date.UTC(2026, 9, 25, 9, 30),
}

/** A site owned by Ann with an editor, Bob, and one stored enquiry. */
async function site() {
  const t = setup()
  const siteId = await addSite(t, "r2c2")
  for (const [name, role] of [
    ["Ann", "owner"],
    ["Bob", "editor"],
  ] as const) {
    await t.action(internal.staff.create, {
      email: `${name.toLowerCase()}@r2c2.dev`,
      name,
      password: "correct-horse",
      role,
    })
  }
  const enquiryId = await t.run((ctx) =>
    ctx.db.insert("enquiries", {
      siteId,
      ...ENQUIRY,
      status: "new",
      bodyHash: "h",
    })
  )
  const notify = (replyTo?: string) =>
    t.mutation(internal.notifications.enquiryEmail, { enquiryId, replyTo })
  return { t, enquiryId, notify }
}

const sent = () => send.mock.calls.map(([, options]) => options)

describe("enquiryEmail", () => {
  test("in test mode, sends one email to Resend's test inbox naming the owners", async () => {
    const { enquiryId, notify } = await site()
    await notify("ada@example.com")
    expect(sent()).toEqual([
      expect.objectContaining({
        from: "R2C2 <hello@r2c2.dev>",
        to: TEST_INBOX,
        subject: "New enquiry on r2c2: contact",
        replyTo: ["ada@example.com"],
        idempotencyKey: `enquiry:${enquiryId}`,
        text: expect.stringContaining("(Test mode: for ann@r2c2.dev)"),
      }),
    ])
  })

  test("outside test mode, sends to the owners only", async () => {
    vi.stubEnv("RESEND_TEST_MODE", "false")
    const { notify } = await site()
    await notify()
    expect(sent()).toEqual([
      expect.objectContaining({
        to: ["ann@r2c2.dev"],
        text: expect.not.stringContaining("Test mode"),
      }),
    ])
  })

  test("leaves out Reply-To when the form has no email", async () => {
    const { notify } = await site()
    await notify()
    expect(sent()[0]).not.toHaveProperty("replyTo")
  })

  test("sends nothing for a missing enquiry or without a sender", async () => {
    const { t, enquiryId, notify } = await site()
    await t.run((ctx) => ctx.db.delete("enquiries", enquiryId))
    await notify()
    vi.stubEnv("EMAIL_FROM", "")
    await (await site()).notify()
    expect(sent()).toEqual([])
  })
})

describe("enquiryEmailText", () => {
  test("lists the fields, the page, the time and the Loft link", () => {
    const { text } = enquiryEmailText(
      { _id: "s1" as Id<"sites">, name: "Clinic" },
      ENQUIRY,
      "https://loft.example"
    )
    expect(text).toBe(
      [
        'New enquiry from the "contact" form on Clinic.',
        "",
        "name: Ada",
        "email: ada@example.com",
        "message: Hi",
        "",
        "Page: /contact",
        "Received: Sun, 25 Oct 2026 09:30:00 GMT",
        "See it in the Loft: https://loft.example/sites/s1",
      ].join("\n")
    )
  })
})
