import { expect, test } from "vite-plus/test"
import { internal } from "./_generated/api"
import { scheduled, setup } from "../test/setup"

test("the seed creates the r2c2 site once", async () => {
  const t = setup()
  const first = await t.mutation(internal.seed.default, {})
  const second = await t.mutation(internal.seed.default, {})
  expect(second).toBe(first)

  const counts = await t.run(async (ctx) => ({
    sites: (await ctx.db.query("sites").collect()).length,
    domains: (await ctx.db.query("domains").collect()).map((d) => d.kind),
    pages: (await ctx.db.query("pages").collect()).map((p) => p.path),
  }))
  expect((await scheduled(t)).map(([name]) => name)).toEqual([
    "routes:sync",
    "routes:sync",
  ])
  expect(counts).toEqual({
    sites: 1,
    domains: ["primary", "redirect"],
    pages: ["/"],
  })
})
