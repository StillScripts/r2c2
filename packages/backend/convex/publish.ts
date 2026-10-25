"use node"

import {
  ASSET_CONTENT_TYPES,
  ASSETS_PREFIX,
  assetKey,
  ELEMENTS_PREFIX,
  elementsKey,
  hashContent,
  type LivePageMetadata,
  liveKey,
  versionKey,
} from "@workspace/core"
import { buildRelease, type Issue, loadTheme } from "@workspace/html"
import { v } from "convex/values"
import { ELEMENTS_JS } from "../elements.gen"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { action, type ActionCtx } from "./_generated/server"
import { fail } from "./errors"
import { formClash } from "./publishing"
import { getObjectText, objectExists, putObject } from "./storage"

const HTML = "text/html; charset=utf-8"

type PublishResult =
  | { ok: false; errors: Issue[]; warnings: Issue[] }
  | { ok: true; versionId: Id<"pageVersions">; warnings: Issue[] }

const elementsHash = hashContent(ELEMENTS_JS)

/** Upload the shared elements script, once per version of it. */
async function uploadElements(ctx: ActionCtx, hash: string) {
  const key = elementsKey(hash)
  if (!(await objectExists(key))) {
    await putObject(ctx, key, ELEMENTS_JS, ASSET_CONTENT_TYPES.js!)
  }
}

const writeLive = (
  ctx: ActionCtx,
  siteId: Id<"sites">,
  path: string,
  html: string,
  metadata: LivePageMetadata
) => putObject(ctx, liveKey(siteId, path), html, HTML, metadata)

/**
 * Publish a page's draft: build the release, write its CSS, version and live copy to
 * R2, then mark it live. The edge serves it once its cached copy expires (ADR-011).
 */
export const publish = action({
  args: { siteId: v.id("sites"), pageId: v.id("pages") },
  handler: async (ctx, { siteId, pageId }): Promise<PublishResult> => {
    const context = await ctx.runQuery(internal.publishing.context, {
      siteId,
      pageId,
    })
    const draftHtml = context.page.draftHtml
    const scriptHash = await elementsHash
    const scriptUrl = `${ELEMENTS_PREFIX}${scriptHash}.js`
    const release = await buildRelease(draftHtml, {
      theme: await loadTheme(context.theme),
      canonicalUrl: context.canonicalUrl,
      sitekey: process.env.TURNSTILE_SITE_KEY,
      elementsUrl: scriptUrl,
      cssUrl: (hash) => `${ASSETS_PREFIX}${hash}.css`,
    })
    if (!release.ok) return release

    const clash = formClash(release.forms, context.otherForms)
    if (clash) throw fail("form_conflict", { form: clash })

    const { html, hash, css, cssHash } = release
    if (html.includes(scriptUrl)) await uploadElements(ctx, scriptHash)
    await putObject(
      ctx,
      assetKey(siteId, cssHash, "css"),
      css,
      ASSET_CONTENT_TYPES.css!
    )
    await putObject(ctx, versionKey(siteId, hash), html, HTML)
    await writeLive(ctx, siteId, context.page.path, html, {
      page: pageId,
      hash,
    })

    const versionId = await ctx.runMutation(internal.publishing.markLive, {
      siteId,
      pageId,
      actor: context.userId,
      draftHtml,
      draftWithIds: release.draftWithIds,
      hash,
      cssHash,
      forms: release.forms,
    })
    return { ok: true, versionId, warnings: release.warnings }
  },
})

/** Make an older version of a page live again. The draft is left as it is. */
export const rollback = action({
  args: {
    siteId: v.id("sites"),
    pageId: v.id("pages"),
    versionId: v.id("pageVersions"),
  },
  handler: async (ctx, { siteId, pageId, versionId }): Promise<void> => {
    const context = await ctx.runQuery(internal.publishing.context, {
      siteId,
      pageId,
      versionId,
    })
    const version = context.version!
    const clash = formClash(version.forms, context.otherForms)
    if (clash) throw fail("form_conflict", { form: clash })

    const html = await getObjectText(versionKey(siteId, version.hash))
    await writeLive(ctx, siteId, context.page.path, html, {
      page: pageId,
      hash: version.hash,
    })
    await ctx.runMutation(internal.publishing.markRolledBack, {
      siteId,
      pageId,
      versionId,
      actor: context.userId,
    })
  },
})
