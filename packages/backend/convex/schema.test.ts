import { expect, test } from "vite-plus/test"
import { addSite, setup } from "../test/setup"

test("the schema rejects unknown roles and domain kinds", async () => {
  const t = setup()
  const siteId = await addSite(t, "a")
  await expect(
    t.run((ctx) =>
      ctx.db.insert("memberships", {
        userId: "ann",
        siteId,
        role: "admin" as "owner",
      })
    )
  ).rejects.toThrow()
  await expect(
    t.run((ctx) =>
      ctx.db.insert("domains", {
        siteId,
        hostname: "a.localhost",
        kind: "alias" as "primary",
        status: "active",
      })
    )
  ).rejects.toThrow()
})
