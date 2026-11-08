"use node"

import {
  BUILD_PREFIX,
  BUILD_SHELL,
  type BuildFile,
  buildFileProblems,
  buildIdOf,
  buildKey,
  hashContent,
  liveKey,
  versionKey,
} from "@workspace/core"
import { buildAppShell, type Issue } from "@workspace/html"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { type ActionCtx, internalAction } from "./_generated/server"
import { whileClaimed } from "./claims"
import { getObjectText, objectSize, putHtml, uploadUrl } from "./storage"
import { buildFile } from "./validators"

type Refused = { ok: false; errors: string[] }

type StartResult =
  | Refused
  | {
      ok: true
      deployId: Id<"appClaims">
      buildId: string
      /** The files R2 doesn't hold yet, each to PUT to its presigned URL */
      uploads: { path: string; url: string }[]
    }

const actor = v.optional(v.string())

const releaseSite = (ctx: ActionCtx, claimId: Id<"appClaims">) => () =>
  ctx.runMutation(internal.deploying.release, { claimId })

/** The files R2 doesn't hold at their listed size. */
async function unstored(files: BuildFile[], keyOf: (path: string) => string) {
  const sizes = await Promise.all(
    files.map((file) => objectSize(keyOf(file.path)))
  )
  return files.filter((file, i) => sizes[i] !== file.bytes)
}

const shellIssue = ({ line, message }: Issue) =>
  `${BUILD_SHELL} line ${line}: ${message}`

const writeLive = (siteId: Id<"sites">, html: string, hash: string) =>
  putHtml(liveKey(siteId, "/"), html, { hash })

/**
 * Start deploying a build to an app site: check its file list, claim the site, and
 * return a presigned upload URL for each file R2 doesn't hold yet (ADR-022). Run from the
 * CLI, then upload and call `apps:finishDeploy` within 15 minutes.
 */
export const startDeploy = internalAction({
  args: { slug: v.string(), files: v.array(buildFile), actor },
  handler: async (
    ctx,
    { slug, files, actor = "system" }
  ): Promise<StartResult> => {
    const errors = buildFileProblems(files)
    if (errors.length) return { ok: false, errors }

    const buildId = await buildIdOf(files)
    const { claimId, siteId, stored } = await ctx.runMutation(
      internal.deploying.claimDeploy,
      { slug, buildId, files, actor }
    )
    const keyOf = (path: string) => buildKey(siteId, buildId, path)
    try {
      const missing = stored ? [] : await unstored(files, keyOf)
      const uploads = await Promise.all(
        missing.map(async ({ path }) => ({
          path,
          url: await uploadUrl(keyOf(path)),
        }))
      )
      return { ok: true, deployId: claimId, buildId, uploads }
    } catch (error) {
      await releaseSite(ctx, claimId)()
      throw error
    }
  },
})

/**
 * Finish a deploy once its files are uploaded: confirm each one, point `index.html` at
 * the build, check it against the app shell rules, then make it live. Either way the
 * claim is let go, so a refused deploy starts again.
 */
export const finishDeploy = internalAction({
  args: { deployId: v.id("appClaims") },
  handler: async (
    ctx,
    { deployId }
  ): Promise<Refused | { ok: true; buildId: string }> => {
    const { siteId, buildId, files } = await ctx.runQuery(
      internal.deploying.deployClaim,
      { claimId: deployId }
    )
    return whileClaimed(releaseSite(ctx, deployId), async () => {
      const keyOf = (path: string) => buildKey(siteId, buildId, path)
      const sizes = await Promise.all(
        files.map((file) => objectSize(keyOf(file.path)))
      )
      const missing = files.flatMap(({ path, bytes }, i) =>
        sizes[i] === null
          ? [`"${path}" wasn't uploaded.`]
          : sizes[i] !== bytes
            ? [`"${path}" is ${sizes[i]} bytes, not the ${bytes} listed.`]
            : []
      )
      if (missing.length) return { ok: false, errors: missing }

      const shell = buildAppShell(await getObjectText(keyOf(BUILD_SHELL)), {
        base: `${BUILD_PREFIX}${buildId}/`,
        files: new Set(files.map((file) => file.path)),
      })
      if (!shell.ok) return { ok: false, errors: shell.errors.map(shellIssue) }

      const htmlHash = await hashContent(shell.html)
      await putHtml(versionKey(siteId, htmlHash), shell.html)
      await writeLive(siteId, shell.html, htmlHash)
      await ctx.runMutation(internal.deploying.markDeployed, {
        claimId: deployId,
        htmlHash,
      })
      return { ok: true, buildId }
    })
  },
})

/** Put an app site's earlier build back live: `convex run apps:rollback '{"slug": "surf", "buildId": "…"}'`. */
export const rollback = internalAction({
  args: { slug: v.string(), buildId: v.string(), actor },
  handler: async (ctx, { slug, buildId, actor = "system" }): Promise<void> => {
    const { claimId, siteId, htmlHash } = await ctx.runMutation(
      internal.deploying.claimRollback,
      { slug, buildId, actor }
    )
    await whileClaimed(releaseSite(ctx, claimId), async () => {
      const html = await getObjectText(versionKey(siteId, htmlHash))
      await writeLive(siteId, html, htmlHash)
      await ctx.runMutation(internal.deploying.markRolledBack, { claimId })
    })
  },
})
