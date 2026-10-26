import betterAuth from "@convex-dev/better-auth/test"
import rateLimiter from "@convex-dev/rate-limiter/test"
import resend from "@convex-dev/resend/test"
import { convexTest } from "convex-test"
import { expect } from "vite-plus/test"
import type { Id } from "../convex/_generated/dataModel"
import schema from "../convex/schema"
import historySchema from "../node_modules/@convex-dev/table-history/dist/esm/component/schema.js"
import type { Role } from "../convex/validators"

const modules = import.meta.glob("../convex/**/*.*s")
// table-history has no /test export, so register its component files directly
const historyModules = import.meta.glob(
  "../node_modules/@convex-dev/table-history/dist/esm/component/**/*.js"
)

export const setup = () => {
  const t = convexTest(schema, modules)
  betterAuth.register(t)
  rateLimiter.register(t)
  resend.register(t)
  t.registerComponent("pageHistory", historySchema, historyModules)
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

/** Add a member to an existing site. */
export const addMember = (
  t: ReturnType<typeof setup>,
  siteId: Id<"sites">,
  member: { userId: string; role: Role }
) => t.run((ctx) => ctx.db.insert("memberships", { siteId, ...member }))

/** Matches a ConvexError thrown with `fail(code, details)`. */
export const errorCode = (code: string, details?: object) =>
  expect.objectContaining({ data: { code, ...details } })

/** Queued scheduled functions, oldest first. */
export const scheduledJobs = (t: ReturnType<typeof setup>) =>
  t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())

/** Scheduled function calls, as `[name, args]`. */
export const scheduled = async (t: ReturnType<typeof setup>) =>
  (await scheduledJobs(t)).map((job) => [job.name, job.args[0]] as const)
