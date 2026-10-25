import { convexTest } from "convex-test"
import type { Id } from "../convex/_generated/dataModel"
import schema from "../convex/schema"
import type { Role } from "../convex/validators"

const modules = import.meta.glob("../convex/**/*.*s")

export const setup = () => convexTest(schema, modules)

/** Create a site, optionally with a member, and return its ID. */
export async function addSite(
  t: ReturnType<typeof setup>,
  slug: string,
  member?: { userId: string; role: Role }
): Promise<Id<"sites">> {
  return t.run(async (ctx) => {
    const siteId = await ctx.db.insert("sites", {
      name: slug,
      slug,
      status: "live",
      theme: "",
    })
    if (member) await ctx.db.insert("memberships", { siteId, ...member })
    return siteId
  })
}
