import { v } from "convex/values"
import { components, internal } from "./_generated/api"
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server"
import { authComponent, createAuth } from "./auth"
import { role } from "./validators"

/**
 * Create a staff account, or reuse the one with this email, and add it to a site (the seed
 * by default). The site's first member becomes its owner. Run from the CLI:
 * `vp exec convex run staff:create '{"email": "…", "name": "…", "password": "…"}'`
 */
export const create = internalAction({
  args: {
    email: v.string(),
    // Only needed when the email has no account yet
    name: v.optional(v.string()),
    password: v.optional(v.string()),
    site: v.optional(v.string()),
    role: v.optional(role),
  },
  handler: async (ctx, args): Promise<{ userId: string; role: string }> => {
    const slug = args.site ?? "r2c2"
    const siteId = await ctx.runQuery(internal.staff.siteBySlug, { slug })
    if (!siteId) throw new Error(`No site with slug "${slug}"`)

    const email = args.email.toLowerCase()
    const existing = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: email }],
    })
    let userId = existing?._id as string | undefined
    if (!userId) {
      if (!args.name || !args.password) {
        throw new Error("A new account needs a name and a password")
      }
      const auth = createAuth(ctx, { signUp: true })
      const { user } = await auth.api.signUpEmail({
        body: { email, name: args.name, password: args.password },
      })
      userId = user.id
    }
    return ctx.runMutation(internal.staff.addMember, {
      siteId,
      userId,
      role: args.role,
    })
  },
})

export const siteBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique()
    return site?._id ?? null
  },
})

/** Add a user to a site: owner if it has no members yet, otherwise `role` (editor by default). */
export const addMember = internalMutation({
  args: { siteId: v.id("sites"), userId: v.string(), role: v.optional(role) },
  handler: async (ctx, { siteId, userId, role }) => {
    const [membership, anyMember] = await Promise.all([
      ctx.db
        .query("memberships")
        .withIndex("by_user_site", (q) =>
          q.eq("userId", userId).eq("siteId", siteId)
        )
        .unique(),
      ctx.db
        .query("memberships")
        .withIndex("by_site", (q) => q.eq("siteId", siteId))
        .first(),
    ])
    if (membership) throw new Error("Already a member of this site")

    const granted = anyMember ? (role ?? "editor") : "owner"
    await ctx.db.insert("memberships", { siteId, userId, role: granted })
    // audit() needs a signed-in member, so record the CLI as "system"
    await ctx.db.insert("auditLog", {
      siteId,
      actor: "system",
      action: "member.add",
      target: userId,
      at: Date.now(),
    })
    return { userId, role: granted }
  },
})

/** The signed-in user and the sites they belong to, or null when signed out. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.safeGetAuthUser(ctx)
    if (!user) return null
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user_site", (q) => q.eq("userId", user._id))
      .collect()
    const sites = await Promise.all(
      memberships.map(async ({ siteId, role }) => {
        const site = await ctx.db.get("sites", siteId)
        return site && { siteId, name: site.name, role }
      })
    )
    return {
      name: user.name,
      email: user.email,
      sites: sites.filter((site) => site !== null),
    }
  },
})
