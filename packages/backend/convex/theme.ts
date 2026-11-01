"use node"

import { compileCss, loadTheme, themeProblem } from "@workspace/html"
import { v } from "convex/values"
// Imported here so Convex installs tailwindcss as an external package: imports from
// @workspace/html don't count, and loadTheme reads tailwindcss/index.css at runtime
import "tailwindcss"
import { api, internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { type ActionCtx, action } from "./_generated/server"
import { fail } from "./errors"

type Problem = { ok: false; message: string }

// Refuse outsiders and editors before spending time compiling
async function requireOwner(ctx: ActionCtx, siteId: Id<"sites">) {
  const site = await ctx.runQuery(api.sites.get, { siteId })
  if (site.role !== "owner") throw fail("forbidden")
}

/** Compile a site's theme and save it if it compiles, or say why it doesn't. */
export const save = action({
  args: { siteId: v.id("sites"), theme: v.string() },
  handler: async (ctx, { siteId, theme }): Promise<{ ok: true } | Problem> => {
    await requireOwner(ctx, siteId)
    const message = await themeProblem(theme)
    if (message) return { ok: false, message }
    await ctx.runMutation(internal.sites.setTheme, { siteId, theme })
    return { ok: true }
  },
})

/** Compile a page's CSS with an unsaved theme, or say why the theme doesn't compile. */
export const preview = action({
  args: { siteId: v.id("sites"), theme: v.string(), html: v.string() },
  handler: async (
    ctx,
    { siteId, theme, html }
  ): Promise<{ ok: true; css: string } | Problem> => {
    await requireOwner(ctx, siteId)
    const message = await themeProblem(theme)
    if (message) return { ok: false, message }
    const { css } = await compileCss(html, await loadTheme(theme))
    return { ok: true, css }
  },
})
