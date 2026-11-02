import { expect, test } from "vite-plus/test"
import { api } from "./_generated/api"
import { errorCode, setup } from "../test/setup"
import { viewOf } from "./preferences"

const viewsOf = (t: ReturnType<typeof setup>, ...userIds: string[]) =>
  t.run((ctx) => Promise.all(userIds.map((userId) => viewOf(ctx, userId))))

test("a user who hasn't picked a view gets Harbour", async () => {
  expect(await viewsOf(setup(), "ann")).toEqual(["harbour"])
})

test("setView saves the caller's view and updates it in place", async () => {
  const t = setup()
  const ann = t.withIdentity({ subject: "ann" })
  await ann.mutation(api.preferences.setView, { view: "coast" })
  await ann.mutation(api.preferences.setView, { view: "alps" })
  expect(await viewsOf(t, "ann", "bob")).toEqual(["alps", "harbour"])
  expect(
    await t.run((ctx) => ctx.db.query("preferences").collect())
  ).toHaveLength(1)
})

test("signed-out callers can't set a view", async () => {
  await expect(
    setup().mutation(api.preferences.setView, { view: "coast" })
  ).rejects.toEqual(errorCode("unauthenticated"))
})
