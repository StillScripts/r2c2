import type { QueryCtx } from "./_generated/server"
import { mutation } from "./_generated/server"
import { fail } from "./errors"
import { type View, view } from "./validators"

export const DEFAULT_VIEW: View = "harbour"

const preferencesOf = (ctx: QueryCtx, userId: string) =>
  ctx.db
    .query("preferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique()

/** The user's view, or the default if they haven't picked one. */
export async function viewOf(ctx: QueryCtx, userId: string) {
  return (await preferencesOf(ctx, userId))?.view ?? DEFAULT_VIEW
}

/** Set the signed-in user's view. */
export const setView = mutation({
  args: { view },
  handler: async (ctx, { view }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw fail("unauthenticated")
    const userId = identity.subject
    const preferences = await preferencesOf(ctx, userId)
    if (preferences) {
      await ctx.db.patch("preferences", preferences._id, { view })
    } else {
      await ctx.db.insert("preferences", { userId, view })
    }
  },
})
