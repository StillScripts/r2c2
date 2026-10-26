import { expect, test } from "vite-plus/test"
import { internal } from "./_generated/api"
import { draftHistory } from "./history"
import { errorCode, scheduled, setup } from "../test/setup"

test("the seed creates the r2c2 site once", async () => {
  const t = setup()
  const first = await t.mutation(internal.seed.default, {})
  const second = await t.mutation(internal.seed.default, {})
  expect(second).toBe(first)

  const counts = await t.run(async (ctx) => ({
    sites: (await ctx.db.query("sites").collect()).length,
    domains: (await ctx.db.query("domains").collect()).map((d) => d.kind),
    pages: (await ctx.db.query("pages").collect()).map((p) => p.path),
    enquiries: (await ctx.db.query("enquiries").collect()).length,
  }))
  expect((await scheduled(t)).map(([name]) => name)).toEqual([
    "routes:sync",
    "routes:sync",
  ])
  expect(counts).toEqual({
    sites: 1,
    domains: ["address"],
    pages: ["/"],
    enquiries: 1,
  })
})

const page = (title: string) =>
  `<html lang="en"><head><title>${title}</title></head><body></body></html>`

test("importSite loads the theme and drafts into the seed site", async () => {
  const t = setup()
  const siteId = await t.mutation(internal.seed.default, {})
  await t.mutation(internal.seed.importSite, {
    theme: "@theme { --color-ink: #000; }",
    pages: [
      { path: "/", html: page("R2C2") },
      { path: "about", html: page("About") },
    ],
  })

  const imported = await t.run(async (ctx) => {
    const pages = await ctx.db.query("pages").collect()
    return {
      theme: (await ctx.db.get("sites", siteId))?.theme,
      pages: await Promise.all(
        pages.map(async ({ _id, path, title, draftHtml }) => ({
          path,
          title,
          draftHtml,
          history: (await draftHistory(ctx, _id)).map(({ reason, actor }) => ({
            reason,
            actor,
          })),
        }))
      ),
    }
  })
  const history = [{ reason: "import", actor: "system" }]
  expect(imported).toEqual({
    theme: "@theme { --color-ink: #000; }",
    pages: [
      { path: "/", title: "R2C2", draftHtml: page("R2C2"), history },
      { path: "/about", title: "About", draftHtml: page("About"), history },
    ],
  })
})

test("importSite snapshots a page's edited draft before replacing it, and audits", async () => {
  const t = setup()
  const siteId = await t.mutation(internal.seed.default, {})
  const theme = "@theme { --color-ink: #000; }"
  const pages = [{ path: "/", html: page("Imported") }]
  await t.mutation(internal.seed.importSite, { theme, pages })
  await t.run(async (ctx) => {
    const home = (await ctx.db.query("pages").first())!
    await ctx.db.patch("pages", home._id, { draftHtml: page("Edited") })
  })
  await t.mutation(internal.seed.importSite, { pages })
  // The draft is already in history now, so this import only records its own snapshot
  await t.mutation(internal.seed.importSite, { pages })

  const { drafts, audit } = await t.run(async (ctx) => {
    const home = (await ctx.db.query("pages").first())!
    return {
      drafts: (await draftHistory(ctx, home._id)).map(
        ({ draftHtml }) => draftHtml.match(/<title>(.*)<\/title>/)?.[1]
      ),
      audit: (await ctx.db.query("auditLog").collect())
        .filter((entry) => entry.siteId === siteId)
        .map(({ action }) => action),
    }
  })
  expect(drafts).toEqual(["Imported", "Imported", "Edited", "Imported"])
  expect(audit).toContain("site.theme")
})

test("importSite refuses an unknown site or a bad path", async () => {
  const t = setup()
  await t.mutation(internal.seed.default, {})
  const theme = ""
  await expect(
    t.mutation(internal.seed.importSite, { slug: "nope", theme, pages: [] })
  ).rejects.toEqual(errorCode("not_found"))
  await expect(
    t.mutation(internal.seed.importSite, {
      theme,
      pages: [{ path: "/../x", html: page("X") }],
    })
  ).rejects.toEqual(errorCode("invalid_path"))
})
