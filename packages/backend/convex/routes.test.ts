import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vite-plus/test"
import { internal } from "./_generated/api"
import { addSite, scheduled, scheduledJobs, setup } from "../test/setup"

describe("routes.sync", () => {
  const fetchMock = vi.fn<typeof fetch>()
  const ok = () => Response.json({ success: true })
  const KV =
    "https://api.cloudflare.com/client/v4/accounts/acct/storage/kv/namespaces/ns"

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "token")
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct")
    vi.stubEnv("CLOUDFLARE_KV_NAMESPACE_ID", "ns")
    fetchMock.mockReset().mockImplementation(async () => ok())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  async function siteWithDomains(version = 1) {
    const t = setup()
    const siteId = await addSite(t, "a")
    await t.run(async (ctx) => {
      await ctx.db.patch("sites", siteId, { routesVersion: version })
      await ctx.db.insert("domains", {
        siteId,
        hostname: "a.dev",
        kind: "primary",
        status: "active",
      })
      await ctx.db.insert("domains", {
        siteId,
        hostname: "old.a.dev",
        kind: "redirect",
        status: "pending",
      })
    })
    return { t, siteId }
  }

  const calls = () =>
    fetchMock.mock.calls.map(([url, init]) => ({
      url,
      method: init?.method,
      auth: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(init?.body as string),
    }))

  test("writes active entries and deletes the rest in two bulk calls", async () => {
    const { t, siteId } = await siteWithDomains()
    await t.action(internal.routes.sync, {
      siteId,
      version: 1,
      removed: ["gone.a.dev"],
    })
    expect(calls()).toEqual([
      {
        url: `${KV}/bulk`,
        method: "PUT",
        auth: "Bearer token",
        body: [
          {
            key: "host:a.dev",
            value: JSON.stringify({ site: siteId, status: "live" }),
          },
        ],
      },
      {
        url: `${KV}/bulk/delete`,
        method: "POST",
        auth: "Bearer token",
        body: ["host:gone.a.dev", "host:old.a.dev"],
      },
    ])
  })

  test("doesn't delete a removed hostname that was added again", async () => {
    const { t, siteId } = await siteWithDomains()
    await t.action(internal.routes.sync, {
      siteId,
      version: 1,
      removed: ["a.dev"],
    })
    expect(calls().at(-1)?.body).toEqual(["host:old.a.dev"])
  })

  test("deletes removed hostnames of a deleted site", async () => {
    const { t, siteId } = await siteWithDomains()
    await t.run(async (ctx) => {
      await ctx.db.delete("sites", siteId)
      for (const domain of await ctx.db.query("domains").collect()) {
        await ctx.db.delete("domains", domain._id)
      }
    })
    await t.action(internal.routes.sync, {
      siteId,
      version: 1,
      removed: ["a.dev"],
    })
    expect(calls()).toEqual([
      expect.objectContaining({ method: "POST", body: ["host:a.dev"] }),
    ])
  })

  test("skips a run older than the site's latest change", async () => {
    const { t, siteId } = await siteWithDomains(2)
    await t.action(internal.routes.sync, { siteId, version: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test("skips when the Cloudflare variables aren't set", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "")
    const { t, siteId } = await siteWithDomains()
    await t.action(internal.routes.sync, { siteId, version: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await scheduled(t)).toEqual([])
  })

  test.each([
    ["an error status", () => new Response("nope", { status: 500 })],
    ["success: false", () => Response.json({ success: false })],
  ])("retries after %s with the next delay", async (_, reply) => {
    fetchMock.mockImplementation(async () => reply())
    const { t, siteId } = await siteWithDomains()
    await t.action(internal.routes.sync, { siteId, version: 1, attempt: 2 })
    const jobs = await scheduledJobs(t)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]!.args[0]).toEqual({ siteId, version: 1, attempt: 3 })
    expect(
      jobs[0]!.scheduledTime - jobs[0]!._creationTime
    ).toBeGreaterThanOrEqual(29_000)
  })

  test("gives up after the fifth attempt", async () => {
    fetchMock.mockImplementation(
      async () => new Response("nope", { status: 500 })
    )
    const { t, siteId } = await siteWithDomains()
    await t.action(internal.routes.sync, { siteId, version: 1, attempt: 5 })
    expect(await scheduled(t)).toEqual([])
  })
})
