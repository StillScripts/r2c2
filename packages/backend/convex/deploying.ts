import { buildContentType } from "@workspace/core"
import { v } from "convex/values"
import type { Doc, Id } from "./_generated/dataModel"
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { writeAudit } from "./access"
import { isActive } from "./claims"
import { fail } from "./errors"
import { findSite, kindOf } from "./sites"
import { buildFile } from "./validators"

/** How long a deploy may run from start to finish: as long as its upload URLs last. */
export const DEPLOY_CLAIM_MS = 15 * 60 * 1000

async function appSite(ctx: QueryCtx, slug: string) {
  const site = await findSite(ctx, slug)
  if (!site) throw fail("not_found")
  if (kindOf(site) !== "app") throw fail("pages_site")
  return site
}

const buildOf = (ctx: QueryCtx, siteId: Id<"sites">, buildId: string) =>
  ctx.db
    .query("appBuilds")
    .withIndex("by_site_build", (q) =>
      q.eq("siteId", siteId).eq("buildId", buildId)
    )
    .unique()

type Claim = Pick<Doc<"appClaims">, "buildId" | "files" | "actor">

/** Claim the app site so no other deploy or rollback runs on it, taking over an expired claim. */
async function claimSite(ctx: MutationCtx, siteId: Id<"sites">, claim: Claim) {
  const held = await ctx.db
    .query("appClaims")
    .withIndex("by_site", (q) => q.eq("siteId", siteId))
    .unique()
  if (held) {
    if (isActive(held)) throw fail("deploy_busy")
    await ctx.db.delete("appClaims", held._id)
  }
  return ctx.db.insert("appClaims", {
    siteId,
    ...claim,
    expiresAt: Date.now() + DEPLOY_CLAIM_MS,
  })
}

async function claimOf(ctx: QueryCtx, claimId: Id<"appClaims">) {
  const claim = await ctx.db.get("appClaims", claimId)
  if (!claim) throw fail("deploy_expired")
  return claim
}

/** Point the site at a recorded build and audit it, once R2's live copy holds its HTML. */
async function goLive(
  ctx: MutationCtx,
  claim: Doc<"appClaims">,
  build: Id<"appBuilds">,
  action: "app.deploy" | "app.rollback"
) {
  await ctx.db.patch("sites", claim.siteId, { liveBuildId: build })
  await writeAudit(ctx, {
    siteId: claim.siteId,
    actor: claim.actor,
    action,
    target: claim.buildId,
  })
}

/** Claim an app site for a deploy of `files`, saying whether it already has this build. */
export const claimDeploy = internalMutation({
  args: {
    slug: v.string(),
    buildId: v.string(),
    files: v.array(buildFile),
    actor: v.string(),
  },
  handler: async (ctx, { slug, ...claim }) => {
    const site = await appSite(ctx, slug)
    return {
      claimId: await claimSite(ctx, site._id, claim),
      siteId: site._id,
      stored: !!(await buildOf(ctx, site._id, claim.buildId)),
    }
  },
})

/** The deploy a finish completes, while its claim is still held. */
export const deployClaim = internalQuery({
  args: { claimId: v.id("appClaims") },
  handler: async (ctx, { claimId }) => {
    const { siteId, buildId, files, ...claim } = await claimOf(ctx, claimId)
    if (!files || !isActive(claim)) throw fail("deploy_expired")
    return { siteId, buildId, files }
  },
})

/** Claim an app site to put one of its earlier builds back live. */
export const claimRollback = internalMutation({
  args: { slug: v.string(), buildId: v.string(), actor: v.string() },
  handler: async (ctx, { slug, buildId, actor }) => {
    const site = await appSite(ctx, slug)
    const build = await buildOf(ctx, site._id, buildId)
    if (!build) throw fail("not_found")
    return {
      claimId: await claimSite(ctx, site._id, { buildId, actor }),
      siteId: site._id,
      htmlHash: build.htmlHash,
    }
  },
})

/** Let the site go once its deploy or rollback has finished or failed. */
export const release = internalMutation({
  args: { claimId: v.id("appClaims") },
  handler: async (ctx, { claimId }) => {
    if (await ctx.db.get("appClaims", claimId)) {
      await ctx.db.delete("appClaims", claimId)
    }
  },
})

/** Record a deployed build, as the latest deploy if the site had it already, and make it live. */
export const markDeployed = internalMutation({
  args: { claimId: v.id("appClaims"), htmlHash: v.string() },
  handler: async (ctx, { claimId, htmlHash }) => {
    const claim = await claimOf(ctx, claimId)
    const deployed = { deployedBy: claim.actor, deployedAt: Date.now() }
    const existing = await buildOf(ctx, claim.siteId, claim.buildId)
    if (existing) await ctx.db.patch("appBuilds", existing._id, deployed)
    const build =
      existing?._id ??
      (await ctx.db.insert("appBuilds", {
        siteId: claim.siteId,
        buildId: claim.buildId,
        files: (claim.files ?? []).map(({ path, bytes }) => ({
          path,
          bytes,
          contentType: buildContentType(path)!,
        })),
        htmlHash,
        ...deployed,
      }))
    await goLive(ctx, claim, build, "app.deploy")
  },
})

/** Point the site back at an earlier build, once R2's live copy holds its HTML. */
export const markRolledBack = internalMutation({
  args: { claimId: v.id("appClaims") },
  handler: async (ctx, { claimId }) => {
    const claim = await claimOf(ctx, claimId)
    const build = await buildOf(ctx, claim.siteId, claim.buildId)
    if (!build) throw fail("not_found")
    await goLive(ctx, claim, build._id, "app.rollback")
  },
})
