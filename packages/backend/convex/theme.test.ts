import { expect, test } from "vite-plus/test"
import { api } from "./_generated/api"
import { addMember, addSite, errorCode, setup } from "../test/setup"
import { MAX_THEME_BYTES } from "./sites"

const THEME = `@theme { --color-brand: #1f5b8a; }\n@utility btn { padding: 1rem; }`

async function siteWithOwner() {
  const t = setup()
  const siteId = await addSite(t, "a", { userId: "ann", role: "owner" })
  return { t, siteId, ann: t.withIdentity({ subject: "ann" }) }
}

const stored = (t: ReturnType<typeof setup>) =>
  t.run(async (ctx) => ({
    theme: (await ctx.db.query("sites").first())?.theme,
    log: await ctx.db.query("auditLog").collect(),
  }))

test("an owner saves a theme that compiles", async () => {
  const { t, siteId, ann } = await siteWithOwner()
  expect(await ann.action(api.theme.save, { siteId, theme: THEME })).toEqual({
    ok: true,
  })
  expect(await stored(t)).toEqual({
    theme: THEME,
    log: [
      expect.objectContaining({
        action: "site.theme",
        actor: "ann",
        target: siteId,
      }),
    ],
  })
})

test("a theme that doesn't compile isn't saved", async () => {
  const { t, siteId, ann } = await siteWithOwner()
  const result = await ann.action(api.theme.save, {
    siteId,
    theme: `@utility btn { @apply no-such-class; }`,
  })
  expect(result).toMatchObject({
    ok: false,
    message: expect.stringMatching(/^The theme doesn't compile: /),
  })
  expect(await stored(t)).toEqual({ theme: "", log: [] })
})

test("a theme over the size limit isn't saved", async () => {
  const { t, siteId, ann } = await siteWithOwner()
  const theme = `/* ${"a".repeat(MAX_THEME_BYTES)} */`
  expect(await ann.action(api.theme.save, { siteId, theme })).toEqual({
    ok: false,
    message: "The theme is over 100 KB.",
  })
  expect((await stored(t)).theme).toBe("")
})

test("only owners save a theme", async () => {
  const { t, siteId } = await siteWithOwner()
  await addMember(t, siteId, { userId: "ed", role: "editor" })
  await expect(
    t
      .withIdentity({ subject: "ed" })
      .action(api.theme.save, { siteId, theme: THEME })
  ).rejects.toEqual(errorCode("forbidden"))
  await expect(
    t
      .withIdentity({ subject: "eve" })
      .action(api.theme.save, { siteId, theme: THEME })
  ).rejects.toEqual(errorCode("not_found"))
  expect((await stored(t)).theme).toBe("")
})
