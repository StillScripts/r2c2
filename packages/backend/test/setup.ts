import rateLimiter from "@convex-dev/rate-limiter/test"
import { convexTest } from "convex-test"
import { expect } from "vite-plus/test"
import type { Id } from "../convex/_generated/dataModel"
import schema from "../convex/schema"
import type { Role } from "../convex/validators"

const modules = import.meta.glob("../convex/**/*.*s")

export function setup() {
  const t = convexTest(schema, modules)
  rateLimiter.register(t)
  return t
}

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

/** Matches a ConvexError thrown with `fail(code)`. */
export const errorCode = (code: string) =>
  expect.objectContaining({ data: { code } })

/** Queued scheduled functions, oldest first. */
export const scheduledJobs = (t: ReturnType<typeof setup>) =>
  t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())

/** Scheduled function calls, as `[name, args]`. */
export const scheduled = async (t: ReturnType<typeof setup>) =>
  (await scheduledJobs(t)).map((job) => [job.name, job.args[0]] as const)
