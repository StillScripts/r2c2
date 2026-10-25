import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions"
import type { TableNamesInDataModel } from "convex/server"
import { v } from "convex/values"
import type { DataModel, Doc, Id } from "./_generated/dataModel"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"

import { fail } from "./errors"
import type { Role } from "./validators"

type SiteCtx = Awaited<ReturnType<typeof loadSite>>

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
  return { site, membership, userId }
}

const siteAccess = {
  args: { siteId: v.id("sites") },
  input: async (
    ctx: QueryCtx,
    { siteId }: { siteId: Id<"sites"> },
    extra: { role?: Role }
  ) => ({ ctx: await loadSite(ctx, siteId, extra.role), args: { siteId } }),
}

/** A public query scoped to one site the caller is a member of; pass `role: "owner"` to refuse editors. */
export const siteQuery = customQuery(query, siteAccess)

/** A public mutation scoped to one site; pass `role: "owner"` to refuse editors. */
export const siteMutation = customMutation(mutation, siteAccess)

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

/** Record an action by the signed-in member on their current site. */
export const audit = (
  ctx: MutationCtx & SiteCtx,
  entry: { action: string; target: string }
) =>
  ctx.db.insert("auditLog", {
    siteId: ctx.site._id,
    actor: ctx.userId,
    ...entry,
    at: Date.now(),
  })
