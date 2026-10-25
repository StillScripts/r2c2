import { convexTest } from "convex-test"
import type { Doc, Id } from "../convex/_generated/dataModel"
import schema from "../convex/schema"

const modules = import.meta.glob("../convex/**/*.*s")

export const setup = () => convexTest(schema, modules)

type Role = Doc<"memberships">["role"]

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
