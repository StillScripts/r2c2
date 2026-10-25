import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions"
import type { TableNamesInDataModel } from "convex/server"
import { ConvexError, v } from "convex/values"
import type { DataModel, Doc, Id } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"

type Role = Doc<"memberships">["role"]
type Code = "unauthenticated" | "not_found" | "forbidden"

const fail = (code: Code) => new ConvexError({ code })

type SiteCtx = {
  site: Doc<"sites">
  membership: Doc<"memberships">
  userId: string
}

async function loadSite(ctx: QueryCtx, siteId: Id<"sites">, needs?: Role) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw fail("unauthenticated")
  const userId = identity.subject
  const [site, membership] = await Promise.all([
    ctx.db.get(siteId),
    ctx.db
      .query("memberships")
      .withIndex("by_user_site", (q) =>
        q.eq("userId", userId).eq("siteId", siteId)
      )
      .unique(),
  ])
  // A site you aren't a member of looks the same as one that doesn't exist
  if (!site || !membership) throw fail("not_found")
  if (needs === "owner" && membership.role !== "owner") throw fail("forbidden")
  return { site, membership, userId } satisfies SiteCtx
}

const siteArgs = { siteId: v.id("sites") }

/** A public query scoped to one site the caller is a member of. */
export const siteQuery = customQuery(query, {
  args: siteArgs,
  input: async (ctx, { siteId }, extra: { role?: Role }) => ({
    ctx: await loadSite(ctx, siteId, extra.role),
    args: { siteId },
  }),
})

/** A public mutation scoped to one site; pass `role: "owner"` to refuse editors. */
export const siteMutation = customMutation(mutation, {
  args: siteArgs,
  input: async (ctx, { siteId }, extra: { role?: Role }) => ({
    ctx: await loadSite(ctx, siteId, extra.role),
    args: { siteId },
  }),
})

type SiteOwnedTable = {
  [T in TableNamesInDataModel<DataModel>]: Doc<T> extends {
    siteId: Id<"sites">
  }
    ? T
    : never
}[TableNamesInDataModel<DataModel>]

/** Load a document that must belong to the caller's current site. */
export async function ownDoc<T extends SiteOwnedTable>(
  ctx: QueryCtx & Pick<SiteCtx, "site">,
  table: T,
  id: Id<T>
) {
  const doc = (await ctx.db.get(table, id)) as Doc<T> | null
  if (!doc || doc.siteId !== ctx.site._id) throw fail("not_found")
  return doc
}

type AuditEntry = { action: string; target: string }

/** Record an action by an internal caller such as an HTTP action or the scheduler. */
export async function auditAs(
  ctx: MutationCtx,
  siteId: Id<"sites">,
  actor: string,
  { action, target }: AuditEntry
) {
  await ctx.db.insert("auditLog", {
    siteId,
    actor,
    action,
    target,
    at: Date.now(),
  })
}

/** Record an action by the signed-in member on their current site. */
export const audit = (ctx: MutationCtx & SiteCtx, entry: AuditEntry) =>
  auditAs(ctx, ctx.site._id, ctx.userId, entry)
