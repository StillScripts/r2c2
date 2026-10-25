import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test"
import { api, components, internal } from "./_generated/api"
import { addSite, setup } from "../test/setup"

describe("staff", () => {
  const ann = { email: "Ann@r2c2.dev", name: "Ann", password: "correct-horse" }

  beforeEach(() => {
    vi.stubEnv("SITE_URL", "http://localhost:3000")
    vi.stubEnv("BETTER_AUTH_SECRET", "a-test-secret-that-is-long-enough")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const post = (t: ReturnType<typeof setup>, path: string, body: object) =>
    t.fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify(body),
    })

  const members = (t: ReturnType<typeof setup>) =>
    t.run(async (ctx) =>
      (await ctx.db.query("memberships").collect()).map((m) => m.role)
    )

  test("the first member owns the site and later ones edit", async () => {
    const t = setup()
    await addSite(t, "r2c2")
    const first = await t.action(internal.staff.create, ann)
    const second = await t.action(internal.staff.create, {
      email: "bob@r2c2.dev",
      name: "Bob",
      password: "battery-staple",
    })
    const third = await t.action(internal.staff.create, {
      email: "cat@r2c2.dev",
      name: "Cat",
      password: "battery-staple",
      role: "owner",
    })
    expect([first.role, second.role, third.role]).toEqual([
      "owner",
      "editor",
      "owner",
    ])
    expect(await members(t)).toEqual(["owner", "editor", "owner"])
    const log = await t.run((ctx) => ctx.db.query("auditLog").collect())
    expect(log.map((e) => [e.actor, e.action, e.target])).toEqual([
      ["system", "member.add", first.userId],
      ["system", "member.add", second.userId],
      ["system", "member.add", third.userId],
    ])
  })

  test("an existing account joins another site without a second account", async () => {
    const t = setup()
    await addSite(t, "r2c2")
    await addSite(t, "b")
    const first = await t.action(internal.staff.create, ann)
    const again = await t.action(internal.staff.create, {
      email: "ann@r2c2.dev",
      site: "b",
    })
    expect(again).toEqual({ userId: first.userId, role: "owner" })
    await expect(
      t.action(internal.staff.create, { email: ann.email })
    ).rejects.toThrow("Already a member")
  })

  test("an unknown site creates no account", async () => {
    const t = setup()
    await expect(
      t.action(internal.staff.create, { ...ann, site: "nope" })
    ).rejects.toThrow('No site with slug "nope"')
    const user = await t.query(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: "ann@r2c2.dev" }],
    })
    expect(user).toBeNull()
  })

  test("a new account needs a name and a password", async () => {
    const t = setup()
    await addSite(t, "r2c2")
    await expect(
      t.action(internal.staff.create, { email: ann.email })
    ).rejects.toThrow("needs a name and a password")
  })

  test("public sign-up is closed", async () => {
    const t = setup()
    const res = await post(t, "sign-up/email", ann)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
    })
  })

  test("staff sign in with their password only", async () => {
    const t = setup()
    await addSite(t, "r2c2")
    await t.action(internal.staff.create, ann)
    const wrong = await post(t, "sign-in/email", {
      email: ann.email,
      password: "wrong-password",
    })
    expect(wrong.status).toBe(401)
    const right = await post(t, "sign-in/email", {
      email: ann.email,
      password: ann.password,
    })
    expect(right.status).toBe(200)
  })

  test("me lists the caller's own sites", async () => {
    const t = setup()
    const r2c2 = await addSite(t, "r2c2")
    await addSite(t, "other", { userId: "someone-else", role: "owner" })
    const { userId } = await t.action(internal.staff.create, ann)
    expect(await t.query(api.staff.me, {})).toBeNull()

    await post(t, "sign-in/email", { email: ann.email, password: ann.password })
    const session = await t.query(components.betterAuth.adapter.findOne, {
      model: "session",
      where: [{ field: "userId", value: userId }],
    })
    const asAnn = t.withIdentity({ subject: userId, sessionId: session?._id })
    expect(await asAnn.query(api.staff.me, {})).toEqual({
      name: "Ann",
      email: "ann@r2c2.dev",
      sites: [{ siteId: r2c2, name: "r2c2", role: "owner" }],
    })
  })
})
