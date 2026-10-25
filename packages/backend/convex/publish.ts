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
import {
  buildRelease,
  type Issue,
  loadTheme,
  type Release,
} from "@workspace/html"
import { v } from "convex/values"
// Imported here so Convex installs tailwindcss as an external package: imports from
// @workspace/html don't count, and loadTheme reads tailwindcss/index.css at runtime
import "tailwindcss"
import { ELEMENTS_JS } from "../elements.gen"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { action } from "./_generated/server"
import { fail } from "./errors"
import { formClash } from "./publishing"
import { getObjectText, objectExists, putObject } from "./storage"

const HTML = "text/html; charset=utf-8"

type PublishResult =
  | Extract<Release, { ok: false }>
  | { ok: true; versionId: Id<"pageVersions">; warnings: Issue[] }

const elementsHash = hashContent(ELEMENTS_JS)

/** Upload the shared elements script, once per version of it. */
async function uploadElements() {
  const key = elementsKey(await elementsHash)
  if (!(await objectExists(key))) {
    await putObject(key, ELEMENTS_JS, ASSET_CONTENT_TYPES.js!)
  }
}

const writeLive = (
  siteId: Id<"sites">,
  path: string,
  html: string,
  metadata: LivePageMetadata
) => putObject(liveKey(siteId, path), html, HTML, metadata)

/**
 * Publish a page's draft: build the release, write its CSS, version and live copy to
 * R2, then mark it live. The edge serves it once its cached copy expires (ADR-011).
 */
export const publish = action({
  args: { siteId: v.id("sites"), pageId: v.id("pages") },
  handler: async (ctx, { siteId, pageId }): Promise<PublishResult> => {
    const context = await ctx.runQuery(internal.publishing.publishContext, {
      siteId,
      pageId,
    })
    const draftHtml = context.page.draftHtml
    const release = await buildRelease(draftHtml, {
      theme: await loadTheme(context.theme),
      canonicalUrl: context.canonicalUrl,
      sitekey: process.env.TURNSTILE_SITE_KEY,
      elementsUrl: `${ELEMENTS_PREFIX}${await elementsHash}.js`,
      cssUrl: (hash) => `${ASSETS_PREFIX}${hash}.css`,
    })
    if (!release.ok) return release

    const clash = formClash(release.forms, context.otherForms)
    if (clash) throw fail("form_conflict", { form: clash })

    const { html, hash, css, cssHash } = release
    await Promise.all([
      release.usesElements && uploadElements(),
      putObject(
        assetKey(siteId, cssHash, "css"),
        css,
        ASSET_CONTENT_TYPES.css!
      ),
      putObject(versionKey(siteId, hash), html, HTML),
    ])
    // Last, so the edge never serves a page whose CSS or script isn't in R2 yet
    await writeLive(siteId, context.page.path, html, { page: pageId, hash })

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
    const { userId, page, version, otherForms } = await ctx.runQuery(
      internal.publishing.rollbackContext,
      { siteId, pageId, versionId }
    )
    const clash = formClash(version.forms, otherForms)
    if (clash) throw fail("form_conflict", { form: clash })

    const html = await getObjectText(versionKey(siteId, version.hash))
    await writeLive(siteId, page.path, html, {
      page: pageId,
      hash: version.hash,
    })
    await ctx.runMutation(internal.publishing.markRolledBack, {
      siteId,
      pageId,
      versionId,
      actor: userId,
    })
  },
})
