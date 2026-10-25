import { expect, test } from "vite-plus/test"
import { api } from "./_generated/api"
import { addSite, errorCode, setup } from "../test/setup"

test("preview refuses outsiders", async () => {
  const t = setup()
  const siteId = await addSite(t, "a", { userId: "ann", role: "owner" })
  await expect(
    t
      .withIdentity({ subject: "eve" })
      .action(api.preview.preview, { siteId, html: "<p>hi</p>" })
  ).rejects.toEqual(errorCode("not_found"))
})
